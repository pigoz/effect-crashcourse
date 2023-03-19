import * as Effect from "@effect/io/Effect";
import * as Exit from "@effect/io/Exit";
import * as Fiber from "@effect/io/Fiber";

import * as ReadonlyArray from "@effect/data/ReadonlyArray";
import * as Chunk from "@effect/data/Chunk";
import * as Duration from "@effect/data/Duration";
import { pipe } from "@effect/data/Function";

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
    Effect.tap(() => Effect.logInfo(`waked from ${identifier.id}`)),
    Effect.flatMap(() => Effect.succeed(identifier)),
  );
};

export const example1 = Effect.gen(function* ($) {
  yield* $(Effect.logInfo("before"));

  // These types can be inferred, we're just explicitly annotating it here
  type fiberT = Fiber.RuntimeFiber<never, Identifier>;
  const fiber: fiberT = yield* $(Effect.fork(sleeper(1)));

  yield* $(Effect.logInfo("after"));

  const id: Identifier = yield* $(Fiber.join(fiber));

  yield* $(Effect.logInfo(JSON.stringify(id)));
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
    Effect.tap(() => Effect.logInfo(`waked from ${id.id}`)),
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

  yield* $(Effect.logInfo(JSON.stringify(exit)));
});

/*
 * Effect makes it easier to write concurrent code
 * despite concurrent code usually being notoriously difficult to write correctly.
 *
 * Effect comes with a many high level functions for common concurrency patterns
 *
 * It's fairly easy to find them with autocompletion because they all have
 * "Par" in their name: allPar, collectPar, collectAllPar, etc.
 */

const effects = [sleeper(1, 300), sleeper(2, 100), sleeper(3, 200)];

export const example4 = Effect.gen(function* ($) {
  // Chunk is an "Array-like" immutable data structure in @effect/data
  type idsT = Chunk.Chunk<Identifier>;
  const ids: idsT = yield* $(Effect.collectAllPar(effects));

  console.log(
    pipe(
      ids,
      Chunk.map(_ => _.id),
      Chunk.toReadonlyArray,
    ),
  );
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
    ReadonlyArray.map(effect =>
      pipe(
        effect,
        Effect.map(_ => _.id),
      ),
    ),
  );

  const sum = pipe(
    identifiers,
    Effect.reduceAllPar(Effect.succeed(0), (acc, a) => acc + a),
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
  const identifiers = pipe(
    [7, 8, 9],
    Effect.forEachPar(x => sleeper(x)), // Effect<never, never, Chunk<Identifier>>
    Effect.map(Chunk.map(_ => _.id.toString())), // Effect<never, never, Chunk<string>>
    Effect.map(Chunk.join(",")), // Effect<never, never, string>
  );

  console.log(yield* $(identifiers));
});

// Effect.runPromise(example7);

/*
 * fiber=#1 message="waked from 7"
 * fiber=#2 message="waked from 8"
 * fiber=#3 message="waked from 9"
 * 7,8,9
 */
