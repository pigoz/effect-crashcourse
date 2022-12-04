import { pipe } from "@fp-ts/data/Function";
import * as E from "@fp-ts/data/Either";
import * as Z from "@effect/io/Effect";
import * as ZL from "@effect/io/Layer";
import * as Context from "@fp-ts/data/Context";

/* Effect is inspired by ZIO, the basic datatype is Effect
 *
 * Z.Effect<R, E, A>
 *
 * You can think of it as a type that models a potentially async computation.
 * The computation has inputs (R), can fail (E) or succeed (A).
 *
 * You can think of Z.Effect<R, E, A> as equivalent to
 *   (r: R) => Promise<Either<E, A>>
 * or
 *   (r: R) => TaskEither<E, A> (in fp-ts 2)
 *
 *  - R is the computation requirements
 *  - E is the type of the error in case if the computation fails
 *  - A is the type of the error in case if the computation succeeds
 */

// Here's some basic constructors
export const s = Z.succeed(7); // Z.Effect<never, never, number>

export const f = Z.fail(3); // Z.Effect<never, number, never>

export const ss = Z.sync(() => {
  console.log("hello from Z.sync");
  return 4;
}); // Z.Effect<never, never, number>

export const sf = Z.failSync(() => {
  console.log("hello from Z.failSync");
  return 4;
}); // Z.Effect<never, number, never>

// Enough of this. It's time to build something real
function eitherFromRandom(random: number): E.Either<"fail", number> {
  return random > 0.5 ? E.right(random) : E.left("fail" as const);
}

// This will fail sometimes
export const x = pipe(
  Z.sync(() => Math.random()), // Z.Effect<never, never, number>
  Z.map(eitherFromRandom), // Z.Effect<never, never, Either<'fail', number>>
  Z.flatMap(Z.fromEither) // Z.Effect<never, 'fail', number>
);

// Same thing but using the number generator provided by Effect
export const y = pipe(
  Z.random(), // Z.Effect<never, never, Random>
  Z.flatMap((random) => random.next()), // Z.Effect<never, never, number>
  Z.map(eitherFromRandom), // Z.Effect<never, never, Either<'fail', number>>
  Z.flatMap(Z.fromEither) // Z.Effect<never, 'fail', number>
);

/* Up to this point we only constructed Effect values, none of the computations
 * that we defined have been executed. Effects are in fact just objects that
 * wrap your computations as they are, for example `pipe(a, flatMap(f))` is
 * represented as `new FlatMap(a, f)`.
 *
 * This allows us to modify computations until we are happy with what they
 * do (using map, flatMap, etc), and then execute them.
 */

Z.unsafeRunPromise(y); // executes y

/* Suppose we want to implement our own custom random generator, and use it in
 * our code as a dependency, similarly to how we used the one provided by
 * Effect
 */
export interface CustomRandom {
  readonly next: () => number;
}

/* To provide us with it's dependency injection features, Effect uses a data
 * structure called Context.Context. It is a table mapping Tags to their
 * implementation (called Service).
 *
 * In types it would be Map<Tag, Service>.
 *
 * In our program we can say that we depend on the implementation of
 * CustomRandom (a tag) by calling Z.service(CustomRandom).
 */
export const CustomRandom = Context.Tag<CustomRandom>();

export const w = pipe(
  Z.service(CustomRandom), // Z.Effect<CustomRandom, never, CustomRandom>
  Z.map((random) => random.next()), // Z.Effect<never, never, number>
  Z.map(eitherFromRandom), // Z.Effect<never, never, Either<'fail', number>>
  Z.flatMap(Z.fromEither) // Z.Effect<never, 'fail', number>
);

/*
 * The cool thing is the CustomRandom we defined as a requirement of `w`
 * doesn't have an implementation.
 *
 * Z.unsafeRunPromise(w);
 *
 * Would lead to the followin type error:
 *
 * Argument of type 'Effect<CustomRandom, "fail", number>' is not assignable
 * to parameter of type 'Effect<never, "fail", number>'.
 * Type 'CustomRandom' is not assignable to type 'never'.
 *
 * So we can use provideService, provideEnvironment, provideLayer, to provide
 * and implementation.
 *
 * By providing an implementation, we turn the R in Effect<R, E, A> into a
 * `never`, so we end up with a Effect<never, E, A> which we can run.
 */

// Providing an implementaion with provideService
// (handy for Effects that depend on a single service)
export const ws = pipe(
  w,
  Z.provideService(CustomRandom)({ next: Math.random })
);

// Providing an implementaion with provideEnvironment
// (handy for Effects that depend on multiple services)
const env = pipe(
  Context.empty(),
  Context.add(CustomRandom)({ next: Math.random })
);

export const we = pipe(
  w, // Z.Effect<CustomRandom, 'fail', number>
  Z.provideEnvironment(env) // Z.Effect<never, 'fail', number>
);

// Providing an implementaion with layers
// (handy for real world systems with complex dependency trees)
// (will go more in depth about layers in a future guide)
export const CustomRandomLive = ZL.succeed(CustomRandom)({ next: Math.random });

export const wl = pipe(w, Z.provideLayer(CustomRandomLive));

/*
 * The powerful part of Effect is you can have multiple implementations for
 * the services your Thunks depend on.
 *
 * This can be useful for i.e. mocking:
 */
export const wt = pipe(w, Z.provideService(CustomRandom)({ next: () => 0.3 }));
