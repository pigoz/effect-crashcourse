import { pipe } from "@effect/data/Function";
import * as Either from "@effect/data/Either";
import * as Effect from "@effect/io/Effect";
import * as Layer from "@effect/io/Layer";
import * as Context from "@effect/data/Context";

/* Effect is inspired by ZIO (a Scala library) - the fundamental data type is Effect
 *
 * Effect<R, E, A>
 *
 * The computation has inputs (R), can fail (E) or succeed (A).
 *
 * You can loosely think of Effect<R, E, A> as similar to:
 *
 *   (r: R) => Promise<Either<E, A>> | Either<E, A>
 *
 *  - R is the computation requirements
 *  - E is the type of the error in case the computation fails
 *  - A is the return type in case the computation succeeds
 *
 * R will be covered in more detail in later chapters, don't worry if it doesn't make sense yet.
 */

// Here's some basic constructors
export const s = Effect.succeed(7); // Effect.Effect<never, never, number>

export const f = Effect.fail(3); // Effect.Effect<never, number, never>

export const ss = Effect.sync(() => {
  console.log("hello from Effect.sync");
  return 4;
}); // Effect.Effect<never, never, number>

export const sf = Effect.failSync(() => {
  console.log("hello from Effect.failSync");
  return 4;
}); // Effect.Effect<never, number, never>

// The following is an example of a computation that can fail. We will look at more examples to handle errors in a later chapter.
function eitherFromRandom(random: number): Either.Either<"fail", number> {
  return random > 0.5 ? Either.right(random) : Either.left("fail" as const);
}

// This will fail sometimes
export const sometimesFailingEffect = pipe(
  Effect.sync(() => Math.random()), // Effect.Effect<never, never, number>
  Effect.map(eitherFromRandom), // Effect.Effect<never, never, Either<'fail', number>>
  Effect.flatMap(Effect.fromEither), // Effect.Effect<never, 'fail', number>
);

// Same thing but using the number generator provided by Effect
/* NOTE:
 * Effect.flatMap(Effect.fromEither) is so common that there's a built in combinator
 * that's equivalent to it: Effect.absolve
 */
export const sometimesFailingEffectAbsolved = pipe(
  Effect.random(), // Effect.Effect<never, never, Random>
  Effect.flatMap(random => random.next()), // Effect.Effect<never, never, number>
  Effect.map(eitherFromRandom), // Effect.Effect<never, never, Either<'fail', number>>
  Effect.absolve, // Effect.Effect<never, 'fail', number>
);

/* Up to this point we only constructed Effect values, none of the computations
 * that we defined have been executed. Effects are just objects that
 * wrap your computations as they are, for example `pipe(a, flatMap(f))` is
 * represented as `new FlatMap(a, f)`.
 *
 * This allows us to modify computations until we are happy with what they
 * do (using map, flatMap, etc), and then execute them.
 * Think of it as defining a workflow, and then running it only when you are ready.
 */

Effect.runPromise(sometimesFailingEffectAbsolved); // executes y

/* As an alternative, instead of using eitherFromRandom and dealing with an
 * Either that we later lift into an Effect, we can write that conditional
 * Effect directly.
 *
 * Both are valid alternatives and the choice on which to use comes down to
 * preference. You may have large subsystems which only depend on Option/Either
 * and lift those into Effects later, or use functions that return the Effect data type everywhere for ease of use.
 */

function flakyEffectFromRandom(random: number) {
  return Effect.cond(
    () => random > 0.5,
    () => random,
    () => "fail" as const,
  );
}

export const sometimesFailingEffectWithCond = pipe(
  Effect.random(), // Effect.Effect<never, never, Random>
  Effect.flatMap(random => random.next()), // Effect.Effect<never, never, number>
  Effect.flatMap(flakyEffectFromRandom), // Effect.Effect<never, 'fail', number>
);

/* ###########################################################################
 * Context
 *
 * Up until now we only dealt with Effects that have no dependencies.
 *
 * The R in Effect<R, E, A> has always been never, meaning that that the Effects we've defined
 * don't depend on anything.
 *
 * Suppose we want to implement our own custom random generator, and use it in
 * our code as a dependency, similar to how we used the one provided by Effect (the Effect.random() above)
 */
export interface CustomRandom {
  readonly next: () => number;
}

/* To provide us with dependency injection features, Effect uses a data
 * structure called Context. It is a table mapping Tags to their
 * implementation (called Service).
 *
 * Think of it as the following type: Map<Tag, Service>.
 *
 * In our program we can say that we depend on the implementation of
 * CustomRandom (a tag) by calling Effect.service(CustomRandom).
 *
 * Here, CustomRandom is an interface, and we can later provide an implementation.
 * You will see why this is really powerful later on.
 */
export const CustomRandom = Context.Tag<CustomRandom>();

export const serviceExample = pipe(
  Effect.service(CustomRandom), // Effect.Effect<CustomRandom, never, CustomRandom>
  Effect.map(random => random.next()), // Effect.Effect<CustomRandom, never, number>
  Effect.flatMap(flakyEffectFromRandom), // Effect.Effect<CustomRandom, 'fail', number>
);

/*
 * Notice how R above is now CustomRandom, meaning that our Effect depends on CustomRandom.
 *
 * However, we haven't yet provided an implementation of CustomRandom. How do we do that?
 *
 * Running the following:
 *
 * Effect.runPromise(w);
 *
 * Would lead to the following type error:
 *
 * Argument of type 'Effect<CustomRandom, "fail", number>' is not assignable
 * to parameter of type 'Effect<never, "fail", number>'.
 * Type 'CustomRandom' is not assignable to type 'never'.
 *
 * Effect has a handful of combinators that allow us to provide an implementation.
 * You will see this in more detail in the following sections and chapters.
 *
 * For example, we can use provideService, provideContext, provideLayer, to provide
 * and implementation.
 *
 * By providing an implementation, we turn the R in Effect<R, E, A> into a
 * `never`, so we end up with a Effect<never, E, A> which we can run.
 */

// Providing an implementation with provideService
// (handy for Effects that depend on a single service)
export const provideServiceExample = pipe(
  serviceExample,
  Effect.provideService(CustomRandom, { next: Math.random }),
);

// Providing an implementation with provideContext
// (handy for Effects that depend on multiple services)
const context = pipe(
  Context.empty(),
  Context.add(CustomRandom, { next: Math.random }),
  // Context.add(Foo)({ foo: 'foo' })
);

export const provideContextExample = pipe(
  serviceExample, // Effect.Effect<CustomRandom, 'fail', number>
  Effect.provideContext(context), // Effect.Effect<never, 'fail', number>
);

// Providing an implementation with layers
// (handy for real world systems with complex dependency trees)
// (will go more in depth about layers in a future guide)
export const CustomRandomLive = Layer.succeed(CustomRandom, {
  next: Math.random,
});

export const wl = pipe(serviceExample, Effect.provideLayer(CustomRandomLive));

/*
 * The powerful part of Effect is you can have multiple implementations for
 * the services you depend on.
 *
 * This can be useful for i.e. mocking:
 * For example, you can use a mocked implementation of CustomRandom in your tests, and a real one in production.
 * You can define these implementations without having to change any of the core logic of your program.
 * Notice how serviceExample doesn't change, but the implementation of CustomRandom can be changed later.
 */
export const wt = pipe(
  serviceExample,
  Effect.provideService(CustomRandom, { next: () => 0.3 }),
);
