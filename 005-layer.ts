import { pipe } from "@fp-ts/core/Function";
import * as Z from "@effect/io/Effect";
import * as ZL from "@effect/io/Layer";
import * as Scope from "@effect/io/Scope";
import * as Exit from "@effect/io/Exit";
import * as Runtime from "@effect/io/Runtime";
import * as Context from "@fp-ts/data/Context";
import * as fs from "node:fs";
import { promisify } from "node:util";

/* In 001-basic we saw a very simple example using Layer to handle dependency
 * injection. Here we build a realistic Layer example using Scope and Runtime
 * that you should be able to use in your own production application.
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
  yield* $(Z.logInfo(`program1 ${JSON.stringify(foo)}`));
});

const program2 = Z.gen(function* ($) {
  const baz = yield* $(Z.service(FileDescriptor));
  const bar = yield* $(Z.service(Bar));
  yield* $(Z.logInfo(`program2 ${JSON.stringify(bar)} ${JSON.stringify(baz)}`));
});

// These are stupid Layers with no lifetime
const FooLive = ZL.succeed(Foo, { foo: 4 });
const BarLive = ZL.succeed(Bar, { bar: 2 });

// This is the exact same "scoped effect" we defined in 004-scope to manage a
// FileDescriptor lifetime!
export const resource: Z.Effect<Scope.Scope, never, FileDescriptor> =
  Z.acquireRelease(
    pipe(
      Z.promise(() => promisify(fs.open)("/dev/null", "w")),
      Z.map(fd => ({ fd })),
      Z.tap(() => Z.logInfo("FileDescriptor acquired")),
    ),
    ({ fd }) =>
      pipe(
        Z.promise(() => promisify(fs.close)(fd)),
        Z.tap(() => Z.logInfo("FileDescriptor released")),
      ),
  );

/*
 * Now comes the interestring part.
 *
 * Similarly to how we used Effect.scoped to provide a Scope to our scoped
 * effect, Layer.scoped builds a Layer from a scoped effect and provides a
 * Scope to it.
 *
 * Every Layer has an implicit Scope which doesn't appear in it's requirements (R),
 * and is the Scope passed to buildWithScope.
 *
 * The main difference is that Effect.scoped provides a scope that's newly
 * created with Scope.make. On the other hand, Layer.scope forks the implicit
 * Scope and provides the child to the scoped Effect.
 *
 * This results in the scoped Effect's release being executed when the implicit
 * Scope is closed (if you recall the previous chapter, acquireRelease adds
 * the release effect to the Scope with addFinalizer).
 */
export const FileDescriptorLive: ZL.Layer<never, never, FileDescriptor> =
  ZL.scoped(FileDescriptor, resource);

/* This next part is the final glue code needed and is platform specific.
 * We assume a Node environment.
 *
 * Firstly, we define a function that given a Layer creates a Runtime and a
 * cleanup Effect (close) that should be run after the Runtime is not useful
 * anymore.
 */
const makeAppRuntime = <R, E, A>(layer: ZL.Layer<R, E, A>) =>
  Z.gen(function* ($) {
    const scope = yield* $(Scope.make());
    const ctx: Context.Context<A> = yield* $(ZL.buildWithScope(scope)(layer));
    const runtime = yield* $(pipe(Z.runtime<A>(), Z.provideContext(ctx)));

    return {
      runtime,
      close: Scope.close(scope, Exit.unit()),
    };
  });

/*
 * We create a layer for our application, concatenating all the "live" layer
 * implementations we defined.
 */
type AppLayer = Foo | Bar | FileDescriptor;

const appLayerLive: ZL.Layer<never, never, AppLayer> = pipe(
  FooLive,
  ZL.provideMerge(BarLive),
  ZL.provideMerge(FileDescriptorLive),
);

/*
 * We create a runtime and the close effect
 */
const promise = Z.runPromise(makeAppRuntime(appLayerLive));

promise.then(({ runtime, close }) => {
  /*
   * Since we are in a Node environment, we register the close effect to be run
   * on node's exit. This will run the release Effect for all the resources in
   * our AppLayer.
   */
  process.on("beforeExit", () => Z.runPromise(close));

  /*
   * Finally, we can run the effects reusing resources. In a webapp these could
   * be requests.
   */
  Runtime.runPromise(runtime)(program1);
  Runtime.runPromise(runtime)(program2);
  Runtime.runPromise(runtime)(program2);
});

/* prints out:
 *
 * FileDescriptor acquire { fd: 22 }
 * program1 { foo: 4 }
 * program2 { bar: 2 } { fd: 22 }
 * program2 { bar: 2 } { fd: 22 }
 * FileDescriptor release
 */
