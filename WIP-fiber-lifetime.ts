import * as Z from "@effect/io/Effect";
import * as Fiber from "@effect/io/Fiber";
import * as Duration from "@fp-ts/data/Duration";
import * as Supervisor from "@effect/io/Supervisor";
import * as Scope from "@effect/io/Scope";
import * as Chunk from "@fp-ts/data/Chunk";
import * as Exit from "@effect/io/Exit";
import { pipe } from "@fp-ts/core/Function";

/*
 * In the previous chapter we saw how to introduce concurrency using Fiber.
 *
 * You may be wondering how to control the lifetime of the forked fiber.
 * Through Scope, of course.
 *
 * Effect.fork we used extensively, attaches the child to the parent Fiber's Scope and
 */

const TICK = 50;

const slow = pipe(
  Z.logInfo("slow task running"),
  Z.delay(Duration.millis(TICK)),
  Z.repeatN(4),
  Z.onInterrupt(() => Z.logInfo("slow task interrupted")),
);

const failing = Z.fail("boom");

export const infinite = pipe(
  Z.logInfo("infinite task running"),
  Z.delay(Duration.millis(TICK)),
  Z.forever,
  Z.onInterrupt(() => Z.logInfo("infinite task interrupted")),
);

export const example0 = Z.gen(function* ($) {
  const sup = yield* $(Supervisor.track());
  yield* $(pipe(Z.fork(infinite), Z.supervised(sup)));
  //psu.onEnd();
  // const fiber = pipe(
  //   sup.value(),
  //   Z.map(Chunk.map(fiber => ({ id: fiber.id(), status: fiber.status() }))),
  //   Z.map(Chunk.unsafeHead),
  // );
  // console.log(yield* $(fiber));
});

Z.runPromise(example0);

export const example1 = Z.gen(function* ($) {
  yield* $(Z.forkDaemon(slow));
  yield* $(Z.sleep(Duration.millis(TICK * 2 + TICK / 2)));
  yield* $(Z.logInfo("done"));
});

// Z.runPromise(example1);

/*
 * This will print the running message 5 times
 * fiber=#1 message="slow task running"
 * fiber=#1 message="slow task running"
 * fiber=#0 message="done"
 * fiber=#1 message="slow task running"
 * fiber=#1 message="slow task running"
 * fiber=#1 message="slow task running"
 */

export const example2 = Z.gen(function* ($) {
  const fiber = yield* $(Z.forkDaemon(slow));
  yield* $(Z.sleep(Duration.millis(TICK * 2 + TICK / 2)));
  yield* $(Z.logInfo("done"));
  yield* $(Fiber.interrupt(fiber));
});

// Z.runPromise(example2);
/*
 * fiber=#1 message="slow task running"
 * fiber=#1 message="slow task running"
 * fiber=#0 message="done"
 */

export const example3 = Z.gen(function* ($) {
  const sup = Supervisor.fromEffect(Z.logInfo("asdf"));
  const fiber = yield* $(Z.fork(pipe(failing, Z.supervised(sup))));
  yield* $(Z.sleep(Duration.millis(TICK * 7 + TICK / 2)));
  yield* $(Z.logInfo("done"));
  yield* $(Fiber.join(fiber));
});

// Z.runPromise(example3).catch(e => console.log(e));

/*
 * boom
 */

// TODO there's no fork0 ?
