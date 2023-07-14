import { pipe, Effect, Exit, Fiber, ReadonlyArray, Duration } from "effect";

/*
 * Until now we executed effects in a way that made them look synchronous.
 *
 * That's one special aspect of Effect - you can mix async and sync code in
 * the same program, without labeling functions separately.
 *
 * To execute an effect without blocking the current process, we can use fibers,
 * which are a lightweight concurrency mechanism.
 */

class Identifier {
  constructor(readonly id: number) {}
}

const sleeper = (id: number, seconds = 1000) => {
  const identifier = new Identifier(id);
  return pipe(
    Effect.sleep(Duration.millis(seconds)),
    Effect.tap(() => Effect.log(`waked from ${identifier.id}`)),
    Effect.flatMap(() => Effect.succeed(identifier)),
  );
};

export const example1 = Effect.gen(function* ($) {
  yield* $(Effect.log("before"));

  // These types can be inferred, we're just explicitly annotating it here
  type fiberT = Fiber.RuntimeFiber<never, Identifier>;
  const fiber: fiberT = yield* $(Effect.fork(sleeper(1)));

  yield* $(Effect.log("after"));

  const id: Identifier = yield* $(Fiber.join(fiber));

  yield* $(Effect.log(JSON.stringify(id)));
});

// Effect.runPromise(example1);

/*
 * Running it yields:
 *
 * fiber=#0 message="before"
 * fiber=#0 message="after"
 * fiber=#1 message="waked from 1"
 * fiber=#0 message="{"op":6,"value":1}"
 *
 * As you can notice, the forked code runs in a separate fiber.
 */

const longFailing = (id: Identifier) =>
  pipe(
    Effect.sleep(Duration.seconds(1)),
    Effect.flatMap(() => Effect.fail("blah" as const)),
    Effect.tap(() => Effect.log(`waked from ${id.id}`)),
    Effect.flatMap(() => Effect.succeed(id)),
  );

/*
 * Using Fiber.join / joinAll will result in a catchable error when running a
 * failing effect
 */
export const example2 = Effect.gen(function* ($) {
  const fiber = yield* $(Effect.fork(longFailing(new Identifier(1))));
  (yield* $(Fiber.join(fiber))) satisfies Identifier;
});

// Effect.runPromise(example2).catch(x => console.log('error', x));

/*
 * An alternative is using await which gives an Exit back
 */

export const example3 = Effect.gen(function* ($) {
  const fiber = yield* $(Effect.fork(longFailing(new Identifier(1))));

  type exitT = Exit.Exit<"blah", Identifier>;
  const exit: exitT = yield* $(Fiber.await(fiber));

  yield* $(Effect.log(JSON.stringify(exit)));
});

/*
 * Effect makes it easier to write concurrent code despite concurrent code
 * usually being notoriously difficult to write correctly.
 */

const effects = [sleeper(1, 300), sleeper(2, 100), sleeper(3, 200)];
//    ^ Effect<never, never, Identifier>[]

/*
 * Most of the Effect high level functions that handle Iterables, accept an
 * options object as a second argument which allows to enable concurrency
 */

const concurrent = { concurrency: "inherit" } as const;

// inherit:
//   uses the current concurrency value (set with Effect.withConcurrency),
//   if nothing is set this defaults to unbounded
//
// unbounded:
//   uses as many fibers are possible
//
// integer value:
//   uses exactly that many fibers

export const example4 = Effect.gen(function* ($) {
  const ids = yield* $(Effect.all(effects, { concurrency: 5 }));
  //    ^ Identifier[]

  console.log(ids);
});

// Effect.runPromise(example4);

/*
 * fiber=#2 message="waked from 2"
 * fiber=#3 message="waked from 3"
 * fiber=#1 message="waked from 1"
 * [ 1, 2, 3 ]
 */

export const example5 = Effect.gen(function* ($) {
  const identifiers: readonly Effect.Effect<never, never, number>[] = pipe(
    effects,
    ReadonlyArray.map(effect => Effect.map(effect, _ => _.id)),
  );

  const sum = pipe(
    identifiers,
    Effect.reduceEffect(Effect.succeed(0), (acc, a) => acc + a, concurrent),
  );

  console.log(yield* $(sum));
});

// Effect.runPromise(example5);

/*
 * fiber=#2 message="waked from 2"
 * fiber=#3 message="waked from 3"
 * fiber=#1 message="waked from 1"
 * 6
 */

export const example6 = Effect.gen(function* ($) {
  const winner = pipe(
    Effect.raceAll(effects), // Races effects with Effect.never()
    Effect.map(_ => _.id),
  );

  console.log(yield* $(winner));
});

// Effect.runPromise(example6);

/*
 * fiber=#2 message="waked from 2"
 * 2
 */

export const example7 = Effect.gen(function* ($) {
  const identifiers = Effect.forEach([7, 8, 9], x => sleeper(x), concurrent);
  //    ^ Effect<never, never, Identifier[]>

  console.log(yield* $(identifiers));
});

// Effect.runPromise(example7);

/*
 * fiber=#1 message="waked from 7"
 * fiber=#2 message="waked from 8"
 * fiber=#3 message="waked from 9"
 * 7,8,9
 */
