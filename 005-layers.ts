import { pipe } from "@fp-ts/data/Function";
import * as Z from "@effect/io/Effect";
import * as ZL from "@effect/io/Layer";
import * as Scope from "@effect/io/Scope";
import * as Exit from "@effect/io/Exit";
import { logged } from "utils/debug";
import * as fs from "node:fs";
import { promisify } from "node:util";

/* In 001-basic we saw a very simple example using Layers to handle dependency
 * injection. Here we build a realistic Layer example using Scopep and Runtime
 * that you chould be able to use in your own production application.
 *
 * Firstly we import some services definitions:
 */
import { Foo, Bar, FileDescriptor } from "utils/contexts";

/*
 * Now we define some Effects using those services.
 * Everything should look familiar to the previous chapters.
 */
const program1 = Z.gen(function* ($) {
  const foo = yield* $(Z.service(Foo));
  console.log("program1", foo);
});

const program2 = Z.gen(function* ($) {
  const baz = yield* $(Z.service(FileDescriptor));
  const bar = yield* $(Z.service(Bar));
  console.log("program2", bar, baz);
});

// These are stupid Layers with no lifetime
const FooLive = ZL.succeed(Foo)({ foo: 4 });
const BarLive = ZL.succeed(Bar)({ bar: 2 });

// This is the exact same "scoped effect" we defined in 004-scope to manage a
// FileDescriptor lifetime!
export const resource: Z.Effect<Scope.Scope, never, FileDescriptor> =
  Z.acquireRelease(
    pipe(
      Z.promise(() => promisify(fs.open)("/dev/null", "w")),
      Z.map((fd) => ({ fd })),
      logged("FileDescriptor acquired")
    ),
    ({ fd }) =>
      pipe(
        Z.promise(() => promisify(fs.close)(fd)),
        logged("FileDescriptor released")
      )
  );

/* Similarly to how we used Effect.scoped to provide a Scope to our scoped
 * effect, Layer.scoped builds a Layer from a scoped effect.
 *
 * ZL.scoped constructs a layer from. Normally you wouldn't
 * need to have a `resource` variable. It was done for clarity purposes.
 */
export const FileDescriptorLive: ZL.Layer<never, never, FileDescriptor> =
  ZL.scoped(FileDescriptor)(resource);

// TODO: similar to 004-scope expand on what ZL.scoped does under the hood

/*
 * Now comes the interestring part.
 *
 * First we define a function that given a Layer creates a Runtime and a
 * cleanup function to be run after the Runtime is not useful anymore.
 *
 * NOTE: instead of providing the
 */
const appRuntime = <R, E, A>(layer: ZL.Layer<R, E, A>) =>
  Z.gen(function* ($) {
    const scope = yield* $(Scope.make());
    const env = yield* $(ZL.buildWithScope(scope)(layer));
    const runtime = yield* $(pipe(Z.runtime<A>(), Z.provideEnvironment(env)));

    return {
      runtime,
      close: Scope.close(Exit.unit())(scope),
    };
  });

/*
 * We create a layer for our application, concatenating all the "live" layer
 * implementations we defined
 * */
type AppLayer = Foo | Bar | FileDescriptor;

const appLayerLive: ZL.Layer<never, never, AppLayer> = pipe(
  FooLive,
  ZL.provideToAndMerge(BarLive),
  ZL.provideToAndMerge(FileDescriptorLive)
);

/*
 * We get a runtime and the close function. If your application allows it, use
 * use unsafeRunPromise instead.
 */
const { runtime, close } = Z.unsafeRunSync(appRuntime(appLayerLive));

/*
 * We register the close function to be run on node's exit. This will run
 * BazLive's release function we defined before.
 */
process.on("beforeExit", () => Z.unsafeRunPromise(close));

/*
 * Finally, we can run the effects reusing resources. In a webapp these could
 * be requests.
 */
runtime.unsafeRunPromise(program1);
runtime.unsafeRunPromise(program2);
runtime.unsafeRunPromise(program2);

/* prints out:
 *
 * FileDescriptor acquire { fd: 22 }
 * program1 { foo: 4 }
 * program2 { bar: 2 } { fd: 22 }
 * program2 { bar: 2 } { fd: 22 }
 * FileDescriptor release
 */
