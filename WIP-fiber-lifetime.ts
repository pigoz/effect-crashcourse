import * as Effect from "@effect/io/Effect";
import * as Fiber from "@effect/io/Fiber";
import * as Duration from "@effect/data/Duration";
import * as Supervisor from "@effect/io/Supervisor";
import * as Scope from "@effect/io/Scope";
import * as Chunk from "@effect/data/Chunk";
import * as Exit from "@effect/io/Exit";
import { pipe } from "@effect/data/Function";

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
  Effect.logInfo("slow task running"),
  Effect.delay(Duration.millis(TICK)),
  Effect.repeatN(4),
  Effect.onInterrupt(() => Effect.logInfo("slow task interrupted")),
);

const failing = Effect.fail("boom");

export const infinite = pipe(
  Effect.logInfo("infinite task running"),
  Effect.delay(Duration.millis(TICK)),
  Effect.forever,
  Effect.onInterrupt(() => Effect.logInfo("infinite task interrupted")),
);

export const example0 = Effect.gen(function* ($) {
  const sup = yield* $(Supervisor.track());
  yield* $(pipe(Effect.fork(infinite), Effect.supervised(sup)));
  //psu.onEnd();
  // const fiber = pipe(
  //   sup.value(),
  //   Effect.map(Chunk.map(fiber => ({ id: fiber.id(), status: fiber.status() }))),
  //   Effect.map(Chunk.unsafeHead),
  // );
  // console.log(yield* $(fiber));
});

Effect.runPromise(example0);

export const example1 = Effect.gen(function* ($) {
  yield* $(Effect.forkDaemon(slow));
  yield* $(Effect.sleep(Duration.millis(TICK * 2 + TICK / 2)));
  yield* $(Effect.logInfo("done"));
});

// Effect.runPromise(example1);

/*
 * This will print the running message 5 times
 * fiber=#1 message="slow task running"
 * fiber=#1 message="slow task running"
 * fiber=#0 message="done"
 * fiber=#1 message="slow task running"
 * fiber=#1 message="slow task running"
 * fiber=#1 message="slow task running"
 */

export const example2 = Effect.gen(function* ($) {
  const fiber = yield* $(Effect.forkDaemon(slow));
  yield* $(Effect.sleep(Duration.millis(TICK * 2 + TICK / 2)));
  yield* $(Effect.logInfo("done"));
  yield* $(Fiber.interrupt(fiber));
});

// Effect.runPromise(example2);
/*
 * fiber=#1 message="slow task running"
 * fiber=#1 message="slow task running"
 * fiber=#0 message="done"
 */

export const example3 = Effect.gen(function* ($) {
  const sup = Supervisor.fromEffect(Effect.logInfo("asdf"));
  const fiber = yield* $(Effect.fork(pipe(failing, Effect.supervised(sup))));
  yield* $(Effect.sleep(Duration.millis(TICK * 7 + TICK / 2)));
  yield* $(Effect.logInfo("done"));
  yield* $(Fiber.join(fiber));
});

// Effect.runPromise(example3).catch(e => console.log(e));

/*
 * boom
 */

// TODO there's no fork0 ?
