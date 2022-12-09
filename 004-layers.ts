import { pipe } from "@fp-ts/data/Function";
import * as Z from "@effect/io/Effect";
import * as ZL from "@effect/io/Layer";
import * as Context from "@fp-ts/data/Context";
import * as Scope from "@effect/io/Scope";
import * as Exit from "@effect/io/Exit";

// define some services
export type LifecycleDebug = { life: number };
export const LifecycleDebug = Context.Tag<LifecycleDebug>();

/* this layer is a demo for running initializers and finalizers */
export const LifecycleDebugLive = ZL.scoped(LifecycleDebug)(
  Z.acquireRelease(
    Z.sync(() => {
      console.log("LifecycleDebugLive", "acquire");
      return { life: 1 };
    }),
    ({ life }) =>
      Z.sync(() => {
        console.log("LifecycleDebugLive", "release", life);
      })
  )
);
export interface Foo {
  readonly foo: number;
}

export const Foo = Context.Tag<Foo>();

export interface Bar {
  readonly bar: number;
}

export const Bar = Context.Tag<Bar>();

// define programs usings the services
const program2 = Z.gen(function* ($) {
  const { foo } = yield* $(Z.service(Foo));
  return foo;
});

const program1 = Z.gen(function* ($) {
  const { life } = yield* $(Z.service(LifecycleDebug));
  const { bar } = yield* $(Z.service(Bar));
  const foo = yield* $(program2);
  console.log("program1", life, foo, bar);
});

// Creates a runtime with a Layer and a clean function to run the Layer's
// finalizers
const appRuntime = <R, E, A>(layer: ZL.Layer<R, E, A>) =>
  Z.gen(function* ($) {
    const scope = yield* $(Scope.make());
    const env = yield* $(ZL.buildWithScope(scope)(layer));
    const runtime = yield* $(pipe(Z.runtime<A>(), Z.provideEnvironment(env)));

    return {
      runtime,
      clean: Scope.close(Exit.unit())(scope),
    };
  });

const FooLive = ZL.succeed(Foo)({ foo: 4 });
const BarLive = ZL.succeed(Bar)({ bar: 2 });

type AppLayer = Foo | Bar | LifecycleDebug;

const appLayerLive: ZL.Layer<never, never, AppLayer> = pipe(
  LifecycleDebugLive,
  ZL.provideToAndMerge(FooLive),
  ZL.provideToAndMerge(BarLive)
);

const { runtime, clean } = Z.unsafeRunSync(appRuntime(appLayerLive));

process.on("beforeExit", () => Z.unsafeRunPromise(clean));
runtime.unsafeRunPromise(program1);

/* prints out:
 *
 * LifecycleDebugLive acquire
 * program1 4 2
 * LifecycleDebugLive release
 */
