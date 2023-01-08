import * as Z from "@effect/io/Effect";
import * as Exit from "@effect/io/Exit";
import * as Fiber from "@effect/io/Fiber";

import * as ReadonlyArray from "@fp-ts/data/ReadonlyArray";
import * as Chunk from "@fp-ts/data/Chunk";
import * as Duration from "@fp-ts/data/Duration";
import { pipe } from "@fp-ts/data/Function";

/*
 * Until now we executed effects in a way that made them look synchronous.
 *
 * That's actually one of the strong points of effect-ts: making async code
 * look synchronous is very useful in application code.
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
    Z.sleep(Duration.millis(seconds)),
    Z.tap(() => Z.logInfo(`waked from ${identifier.id}`)),
    Z.flatMap(() => Z.succeed(identifier)),
  );
};

export const example1 = Z.gen(function* ($) {
  yield* $(Z.logInfo("before"));

  type fiberT = Fiber.RuntimeFiber<never, Identifier>;
  const fiber: fiberT = yield* $(Z.fork(sleeper(1)));

  yield* $(Z.logInfo("after"));

  const id: Identifier = yield* $(Fiber.join(fiber));

  yield* $(Z.logInfo(JSON.stringify(id)));
});

// Z.unsafeRunPromise(example1);

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
    Z.sleep(Duration.seconds(1)),
    Z.flatMap(() => Z.fail("blah" as const)),
    Z.tap(() => Z.logInfo(`waked from ${id.id}`)),
    Z.flatMap(() => Z.succeed(id)),
  );

/*
 * Using Fiber.join / joinAll will result in a catchable error when running a
 * failing effect
 */
export const example2 = Z.gen(function* ($) {
  const fiber = yield* $(Z.fork(longFailing(new Identifier(1))));
  (yield* $(Fiber.join(fiber))) satisfies Identifier;
});

// Z.unsafeRunPromise(example2).catch(x => console.log('error', x));

/*
 * An alternative is using wait which gives an Exit back
 */

export const example3 = Z.gen(function* ($) {
  const fiber = yield* $(Z.fork(longFailing(new Identifier(1))));

  type exitT = Exit.Exit<"blah", Identifier>;
  const exit: exitT = yield* $(Fiber.await(fiber));

  yield* $(Z.logInfo(JSON.stringify(exit)));
});

/*
 * As is any other concurrent code using fork/join (i.e.: pthreads), there are
 * many pitfalls in writing correct code with those low level primitives.
 *
 * Effect comes with a many high level functions for common concurrency patterns
 *
 * It's fairly easy to find them with autocompletion because they all have
 * "Par" in their name: collectPar, collectAllPar, etc.
 */

const effects = [sleeper(1, 300), sleeper(2, 100), sleeper(3, 200)];

export const example4 = Z.gen(function* ($) {
  // Chunk is an "Array-like" data structure in fp-ts
  type idsT = Chunk.Chunk<Identifier>;
  const ids: idsT = yield* $(Z.collectAllPar(effects));

  console.log(
    pipe(
      ids,
      Chunk.map(_ => _.id),
      Chunk.toReadonlyArray,
    ),
  );
});

// Z.unsafeRunPromise(example4);

/*
 * fiber=#2 message="waked from 2"
 * fiber=#3 message="waked from 3"
 * fiber=#1 message="waked from 1"
 * [ 1, 2, 3 ]
 */

export const example5 = Z.gen(function* ($) {
  const identifiers: readonly Z.Effect<never, never, number>[] = pipe(
    effects,
    ReadonlyArray.map(effect =>
      pipe(
        effect,
        Z.map(_ => _.id),
      ),
    ),
  );

  const sum = pipe(
    identifiers,
    Z.reduceAllPar(Z.succeed(0), (acc, a) => acc + a),
  );

  console.log(yield* $(sum));
});

// Z.unsafeRunPromise(example5);

/*
 * fiber=#2 message="waked from 2"
 * fiber=#3 message="waked from 3"
 * fiber=#1 message="waked from 1"
 * 6
 */

export const example6 = Z.gen(function* ($) {
  const winner = pipe(
    Z.never(), // Effect<never, never, never> (never returns)
    Z.raceAll(effects), // Races effects with Z.never()
    Z.map(_ => _.id),
  );

  console.log(yield* $(winner));
});

// Z.unsafeRunPromise(example6);

/*
 * fiber=#2 message="waked from 2"
 * 2
 */

export const example7 = Z.gen(function* ($) {
  const identifiers = pipe(
    [7, 8, 9],
    Z.forEachPar(x => sleeper(x)), // Effect<never, never, Chunk<Identifier>>
    Z.map(Chunk.map(_ => _.id.toString())), // Effect<never, never, Chunk<string>>
    Z.map(Chunk.join(",")), // Effect<never, never, string>
  );

  console.log(yield* $(identifiers));
});

// Z.unsafeRunPromise(example7);

/*
 * fiber=#1 message="waked from 7"
 * fiber=#2 message="waked from 8"
 * fiber=#3 message="waked from 9"
 * 7,8,9
 */
