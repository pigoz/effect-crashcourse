import { pipe } from "@fp-ts/data/Function";
import * as Z from "@effect/io/Effect";
import * as ZL from "@effect/io/Layer";
import * as Context from "@fp-ts/data/Context";
import * as Scope from "@effect/io/Scope";
import * as Exit from "@effect/io/Exit";

/* In 001-basic we saw a veryy simple example using Layers to handle dependency
 * injection. Here we build a realistic Layer example using Scopep and Runtime
 * that you chould be able to use in your own production application.
 *
 * Firstly we define some services:
 */
export interface Foo {
  readonly foo: number;
}

export const Foo = Context.Tag<Foo>();

export interface Bar {
  readonly bar: number;
}

export const Bar = Context.Tag<Bar>();

export interface Baz {
  readonly baz: number;
}

export const Baz = Context.Tag<Baz>();

/*
 * Now we define some Effects using those those services.
 * Everything should look familiar to the previous chapters.
 */
const program1 = Z.gen(function* ($) {
  const foo = yield* $(Z.service(Foo));
  console.log("program1", foo);
});

const program2 = Z.gen(function* ($) {
  const baz = yield* $(Z.service(Baz));
  const bar = yield* $(Z.service(Bar));
  console.log("program2", bar, baz);
});

/*
 * Now comes the interestring part.
 *
 * First we define a function that from a layer creates a Runtime and a
 * cleanup function to be run after the Runtime is not useful anymore.
 *
 * What is Scope? It's a datatype to model the lifetime of resources.
 *
 * By using ZL.buildWithScope and a custom runtime, Effect makes sure we can
 * reuse the same environment to run multiple Effects.
 *
 * Only calling Scope.close will release the resources that were initialized
 * within the scope.
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

// These are stupid Layers with no lifetime
const FooLive = ZL.succeed(Foo)({ foo: 4 });
const BarLive = ZL.succeed(Bar)({ bar: 2 });

/* This is an example of a Layer with a lifetime.
 * Firstly we create a resource (a.k.a: Scoped effect) with acquireRelease.
 *
 * This is the fundamental function to create resources with a lifetime.
 *
 * It makes sure the first argument (`acquire` effect) is run uninterruped.
 * If it runs successfully, effect ensures to also run the second argument
 * (`release` effect) when we close the associated Scope.
 *
 * As you can see from the types, the R value is Scope.Scope, so we can't run
 * `resource` as is. With the following setup code we can make Effect provide
 * the Scope we created in appRuntime to resource.
 */
const resource: Z.Effect<Scope.Scope, never, Baz> = Z.acquireRelease(
  Z.sync(() => {
    console.log("BazLive", "acquire");
    return { baz: 1 };
  }),
  (baz) =>
    Z.sync(() => {
      console.log("BazLive", "release", baz);
    })
);
// XXX would I be able to run resource by providing a scope manually?
// i.e. through provideService
const s = Z.unsafeRunSync(Scope.make());
Z.unsafeRunPromise(pipe(resource, Z.provideService(Scope.Tag)(s)));
Scope.close(Exit.unit())(s)

/*
 * ZL.scoped constructs a layer with the resource. Normally you wouldn't
 * need to have a `resource` variable. It was done for clarity purposes.
 */
export const BazLive = ZL.scoped(Baz)(resource);

/*
 * We create a layer for our application, concatenating all the "live" layer
 * implementations we defined
 * */
type AppLayer = Foo | Bar | Baz;

const appLayerLive: ZL.Layer<never, never, AppLayer> = pipe(
  FooLive,
  ZL.provideToAndMerge(BarLive),
  ZL.provideToAndMerge(BazLive)
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
 * BazLive acquire
 * program1 { foo: 4 }
 * program2 { bar: 2 } { baz: 1 }
 * program2 { bar: 2 } { baz: 1 }
 * BazLive release { baz: 1 }
 */
