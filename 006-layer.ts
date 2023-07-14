import { pipe, Effect, Layer, Scope, Exit, Runtime, Context } from "effect";
import * as fs from "node:fs";
import { promisify } from "node:util";

/* In 001-basic.ts we saw a very simple example using Layer to handle dependency
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
const program1 = Effect.gen(function* ($) {
  const foo = yield* $(Foo);
  yield* $(Effect.log(`program1 ${JSON.stringify(foo)}`));
});

const program2 = Effect.gen(function* ($) {
  const baz = yield* $(FileDescriptor);
  const bar = yield* $(Bar);
  yield* $(
    Effect.log(`program2 ${JSON.stringify(bar)} ${JSON.stringify(baz)}`),
  );
});

// These are simple Layers with no lifetime
const FooLive = Layer.succeed(Foo, { foo: 4 });

// You can even build a layer from an effect
const BarLive = Layer.effect(
  Bar,
  pipe(
    Effect.random,
    Effect.flatMap(random => random.next()),
    Effect.map(bar => ({ bar })),
  ),
);

// This is the exact same "scoped effect" we defined in 004-scope to manage a
// FileDescriptor lifetime!
export const resource: Effect.Effect<Scope.Scope, never, FileDescriptor> =
  Effect.acquireRelease(
    pipe(
      Effect.promise(() => promisify(fs.open)("/dev/null", "w")),
      Effect.map(fd => ({ fd })),
      Effect.tap(() => Effect.log("FileDescriptor acquired")),
    ),
    ({ fd }) =>
      pipe(
        Effect.promise(() => promisify(fs.close)(fd)),
        Effect.tap(() => Effect.log("FileDescriptor released")),
      ),
  );

/*
 * Now comes the interesting part.
 *
 * Similar to how we used Effect.scoped to provide a Scope to our scoped
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
export const FileDescriptorLive: Layer.Layer<never, never, FileDescriptor> =
  Layer.scoped(FileDescriptor, resource);

/* This next part is the final glue code needed and is platform specific.
 * We assume a Node environment.
 *
 * Firstly, we define a function that given a Layer creates a Runtime and a
 * cleanup Effect (close) that should be run after the Runtime is not useful
 * anymore.
 */
const makeAppRuntime = <R, E, A>(layer: Layer.Layer<R, E, A>) =>
  Effect.gen(function* ($) {
    const scope = yield* $(Scope.make());
    const ctx: Context.Context<A> = yield* $(
      Layer.buildWithScope(scope)(layer),
    );
    const runtime = yield* $(
      pipe(Effect.runtime<A>(), Effect.provideContext(ctx)),
    );

    return {
      runtime,
      close: Scope.close(scope, Exit.unit),
    };
  });

/*
 * We create a layer for our application, concatenating all the "live" layer
 * implementations we defined.
 */
type AppLayer = Foo | Bar | FileDescriptor;

const appLayerLive: Layer.Layer<never, never, AppLayer> = pipe(
  FooLive,
  Layer.provideMerge(BarLive),
  Layer.provideMerge(FileDescriptorLive),
);

/*
 * We create a runtime and the close effect
 */
const promise = Effect.runPromise(makeAppRuntime(appLayerLive));

promise.then(({ runtime, close }) => {
  /*
   * Since we are in a Node environment, we register the close effect to be run
   * on node's exit. This will run the release Effect for all the resources in
   * our AppLayer.
   */
  process.on("beforeExit", () => Effect.runPromise(close));

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
