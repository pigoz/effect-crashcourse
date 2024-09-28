import { Effect, Either, Layer, Context, pipe } from "effect";

/*
 * The unique insight of Effect is that errors and requirements/dependencies
 * should be modeled in your program's control flow.
 *
 * This is in contrast to your typical TypeScript code, where a function can
 * either return a "success" value or throw an untyped exception.
 *
 * The data type of Effect looks like the following:
 *
 * Effect<A, E, R>
 *
 * The computation can succeed (A), fail (E), and can have requirements (R)
 *
 * You can loosely think of Effect<A, E, R> as the following type:
 *
 *   (r: R) => Promise<Either<E, A>> | Either<E, A>
 *
 * Similarly to a function, when you define an Effect nothing happens.
 * It's just a value representing some code.
 *
 * This is different from i.e. Promises which are started immediately as they
 * are defined.
 *
 * When you do decide to run an Effect (for example using Effect.runPromise),
 * it will either:
 *
 *  - run successfully and return a value of type A
 *  - fail and throw an error of type E
 *
 * The R geniric type will be covered in detail in future chapters.
 * It's meant to provide some form of dependency injection that you will love.
 * (Trust me it's not the enterprisey stuff you expect from Java)
 *
 * Effect is inspired by ZIO (a Scala library)
 */

/*
 * Notes while going through the rest of this crash course:
 * 1. Effect has excellent type inference. You rarely need to specify types manually.
 * 2. There are explicit type annotations in several parts of this crash course
 * to make it easier for you to follow.
 */

/* Basic constructors
 * ==================
 *
 * The point of these functions is to demonstrate a couple basic ways to
 * create an "Effect" value.
 *
 * Notice how the types change based on the function you call.
 * */

/*
 * succeed creates an Effect value that includes it's argument in the
 * success channel (A in Effect<A, E, R>)
 */
export const succeed = Effect.succeed(7);
//           ^ Effect.Effect<number, never, never>;

/*
 * fail creates an Effect value that includes it's argument in the
 * failure channel (E in Effect<A, E, R>)
 */
export const fail = Effect.fail(3);
//           ^ Effect.Effect<never, never, number>;

/*
 * sync can be thought as a lazy alternative to succeed.
 * A is built lazily only when the Effect is run.
 */
export const sync = Effect.sync(() => new Date());
//           ^ Effect.Effect<Date, never, never>;

/*
 * NOTE: if we used Effect.succeed(new Date()), the date stored in the success
 * channel would be the one when the javascript virtual machine initially
 * loads and executes our code.
 *
 * For values that do not change like a number, it doesn't make any difference.
 */

/*
 * failSync can be thought as a lazy alternative to fail.
 * E is built lazily only when the Effect is run.
 */
export const failSync = Effect.failSync(() => new Date());
//           ^ Effect.Effect<never, Date, never>;

/* suspend allows to lazily build an Effect value.
 *
 * While sync builds A lazily, and failSync builds E lazily, suspend builds
 * the whole Effect<A, E, R> lazily!
 */
export const suspend =
  //         ^ Effect.Effect<Date, '<.5', never>;
  Effect.suspend(() =>
    Math.random() > 0.5
      ? Effect.succeed(new Date())
      : Effect.fail("<.5" as const),
  );

/*
 * Some basic control flow
 * =======================
 *
 * The following is an example of a computation that can fail. We will look at
 * more error handling in a later chapter.
 */
function eitherFromRandom(random: number): Either.Either<number, "fail"> {
  return random > 0.5 ? Either.right(random) : Either.left("fail" as const);
}

// This will fail sometimes
export const flakyEffect = pipe(
  Effect.sync(() => Math.random()), // Effect.Effect<number, never, never>
  Effect.flatMap(eitherFromRandom), // Effect.Effect<number, 'fail', never>
);

// Same thing but using the number generator provided by Effect
export const flakyEffectRandom = pipe(
  Effect.random, // Effect.Effect<Random, never, never>
  Effect.flatMap(random => random.next), // Effect.Effect<number, never, never>
  Effect.flatMap(eitherFromRandom), // Effect.Effect<number, 'fail', never>
);

/* NOTE about Effect.flatMap(eitherFromRandom)
 *
 * Through some black magic, Either and Option are defined as sub types of the
 * Effect type. That means every function in the Effect module can also accept
 * Either or Option and tread them accordingly.
 *
 * Effect.flatMap(() => Either.right(1)) will turn into an Effect.succeed(1)
 * Effect.flatMap(() => Either.left(2)) will turn into an Effect.fail(2)
 */

/* Up to this point we only constructed Effect values, none of the computations
 * that we defined have been executed. Effects are just objects that
 * wrap your computations as they are, for example `pipe(a, flatMap(f))` is
 * represented as `new FlatMap(a, f)`.
 *
 * This allows us to modify computations until we are happy with what they
 * do (using map, flatMap, etc), and then execute them.
 * Think of it as defining a workflow, and then running it only when you are ready.
 */

Effect.runPromise(flakyEffectRandom); // executes flakyEffectRandom

/* As an alternative, instead of using eitherFromRandom and dealing with an
 * Either that we later lift into an Effect, we can write that conditional
 * Effect directly.
 *
 * Both are valid alternatives and the choice on which to use comes down to
 * preference.
 *
 * By using Option/Either and lifting to Effect only when necessary you can
 * keep large portions of code side effect free, stricly syncronous, and not
 * require the Effect runtime to run.
 *
 * Using Effect directly you lose some purity but gain in convenience.
 * It may be warranted if you are using the dependency injection features a
 * lot (especially in non library code).
 */

// This is an Effect native implementation of eitherFromRandom defined above
function effectFromRandom(random: number) {
  return random > 0.5 ? Effect.succeed(random) : Effect.fail("fail" as const);
}

export const flakyEffectNative = pipe(
  Effect.random, // Effect.Effect<never, never, Random>
  Effect.flatMap(random => random.next), // Effect.Effect<number, never, never>
  Effect.flatMap(effectFromRandom), // Effect.Effect<number, 'fail', never>
);

/* Context
 * =======
 *
 * Up until now we only dealt with Effects that have no dependencies.
 *
 * The R in Effect<A, E, R> has always been never, meaning that that the
 * Effects we've defined don't depend on anything.
 *
 * Suppose we want to implement our own custom random generator, and use it in
 * our code as a dependency, similar to how we used the one provided by Effect
 * (the Effect.random() above)
 */

class CustomRandom extends Context.Tag("CustomRandom")<
  CustomRandom,
  { readonly next: Effect.Effect<number> }
>() {}

/* To provide us with dependency injection features, Effect uses a data
 * structure called Context. It is a table mapping Tags to their
 * implementation (called Service).
 *
 * Think of it as the following type: Map<Tag, Service>.
 *
 * An interesting property of Tag is it is a subtype of Effect, so you can for
 * example map and flatMap over it to get to the service.
 *
 * In our case we can do something like:
 *
 *    Effect.map(CustomRandom, (service) => ...)
 *
 * Doing so will introduce a dependency on CustomRandom in our code.
 * That will be reflected in the Effect<A, E, R> datatype, where the
 * requirements channel (R) will become of type CustomRandom.
 */

export const serviceExample = pipe(
  CustomRandom, // Context.Tag<CustomRandom, CustomRandom>
  Effect.flatMap(random => random.next), // Effect.Effect<CustomRandom, never, number>
  Effect.flatMap(effectFromRandom), // Effect.Effect<CustomRandom, 'fail', number>
);

/*
 * Notice how R above is now CustomRandom, meaning that our Effect depends on it.
 * However CustomRandom is just an interface and we haven't provided an
 * implementation for it... yet.
 *
 * How to do that?
 *
 * Taking a step back and trying to compile the following:
 *
 * Effect.runPromise(serviceExample);
 *
 * Would lead to the following type error:
 *
 * Argument of type 'Effect<number, "fail", CustomRandom>' is not assignable
 * to parameter of type 'Effect<number, "fail", never>'.
 * Type 'CustomRandom' is not assignable to type 'never'.
 *
 * To run an Effect we need it to have no missing dependencies, in other
 * words R must be never.
 *
 * By providing an implementation, we turn the R in Effect<A, E, R> into a
 * `never`, so we end up with a Effect<A, E, never> which we can run.
 *
 */

const CustomRandomServiceLive = {
  // Note: in Effect jargon a Service is the implementation for a required Tag
  next: Effect.sync(() => Math.random()),
};

// Providing an implementation with provideService
// (handy for Effects that depend on a single service)
export const provideServiceExample = serviceExample.pipe(
  Effect.provideService(CustomRandom, CustomRandomServiceLive),
);

// Providing an implementation with provideContext
// (handy for Effects that depend on multiple services)
const context = pipe(
  Context.empty(),
  Context.add(CustomRandom, CustomRandomServiceLive),
  // Context.add(Foo)({ foo: 'foo' })
);

export const provideContextExample = pipe(
  serviceExample, // Effect.Effect<number, 'fail', CustomRandom>
  Effect.provide(context), // Effect.Effect<number, 'fail', never>
);

// Providing an implementation with Layer
// (handy for real world systems with complex dependency trees)
// (will go more in depth about layers in a future chapter)
export const liveProgram = pipe(
  serviceExample,
  Effect.provide(Layer.succeed(CustomRandom, CustomRandomServiceLive)),
);

/*
 * The powerful part of Effect is you can have multiple implementations for
 * the services you depend on.
 *
 * This can be useful for i.e. mocking:
 *
 * For example, you can use a mocked implementation of CustomRandom in your
 * tests, and a real one in production.
 *
 * You can define these implementations without having to change any of the
 * core logic of your program. Notice how serviceExample doesn't change, but
 * the implementation of CustomRandom can be changed later.
 */
const CustomRandomServiceTest = {
  next: Effect.succeed(0.3),
};

export const testProgram = pipe(
  serviceExample,
  Effect.provideService(CustomRandom, CustomRandomServiceTest),
);
