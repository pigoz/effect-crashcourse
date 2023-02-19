import * as Z from "@effect/io/Effect";
import * as Effect from "@effect/io/Effect";
import * as Cause from "@effect/io/Cause";
import * as Data from "@effect/data/Data";
import * as Match from "@effect/match";
import * as O from "@fp-ts/core/Option";
import * as E from "@fp-ts/core/Either";
import { identity, pipe } from "@fp-ts/core/Function";

/*
 * Effect (and ZIO) have 3 main types of errors:
 *
 * 1) Failure
 * Generated using Z.fail and appears in the E type of Effect<R,E,A> (which is
 * also known as the failure channel).
 *
 * These are also called 'expected errors' or 'typed errors' in ZIO,
 * or 'recoverable errors' in the Effect docs.
 *
 * They are errors which the developer expects to happen, part of the domain,
 * and part of the program's control flow.
 *
 * In spirit they are similar to checked exceptions.
 *
 * 2) Defect
 * Generated using Z.die, they don't appear in the Effect<R,E,A> type.
 *
 * Also known as 'unexpected errors' or 'untyped errors' in ZIO, or
 * 'unrecoverable errors' in the Effect docs. (NOTE: despite the name there
 * are ways to recover from them but it's way more verbose compared to failures).
 *
 * These are unexpected errors which are not part of the domain, nor the
 * control flow.
 *
 * While it doesn't appear in the type Effect<R,E,A>, the Effect runtime keeps
 * track of these errors in a data structure called Cause (more on this later),
 * and there are combinators that allow to access the Cause and analyze it.
 *
 * In spirit, similar to unchecked exceptions.
 *
 * 3) Interruption
 * Generated with Effect.interrupt to interrupt the executing Fiber, or
 * Fiber.interrupt(fiber) to interrupt `fiber`.
 *
 * An interruption will cause the fiber to return an Exit.Failure containing
 * a Cause.interrupt. Will go more in depth in the Fiber chapters.
 */

/* Building Errors
 * ===============
 *
 * Until now we used string literals in the failure channel of the example
 * effects we built. That was mainly for readability and to not introduce all
 * the concepts at one.
 *
 * In reality it's better to fail with an object that has a _tag field.
 * The reason being Effect comes with a few combinators built specifically to
 * handle such error objects in a typesafe way.
 *
 * You can use either Data.Case or Typescript Classes to define such error
 * types. i.e.:
 */

export interface FooError extends Data.Case {
  readonly _tag: "FooError";
  readonly error: string;
}

export const FooError = Data.tagged<FooError>("FooError");

export class BarError {
  readonly _tag = "BarError";
  constructor(readonly error: string) {}
}

export class BazError {
  readonly _tag = "BazError";
  constructor(readonly error: string) {}
}

/*
 * As you can probably tell, classes are way more concise, but Data.Case has
 * the added benefit of providing an Equal implementation.
 *
 * That allows to compare errors by value instead of reference.
 */

import * as Equal from "@effect/data/Equal";

// This is true because the argument to FooError is compared by value
export const isEqual = Equal.equals(
  FooError({ error: "foo1" }),
  FooError({ error: "foo1" }),
);

// This is not true, foo1 and foo2 are different!
export const isNotEqual = Equal.equals(
  FooError({ error: "foo1" }),
  FooError({ error: "foo2" }),
);

/*
 * NOTE: Aside from Data.Case, Data also has a few other handy data structures
 * to perform comparison by value: Data.struct, Data.tuple, Data.array.
 */

/*
 * Handling failures
 * =================
 *
 * Let's move on and use the Errors we defined! :)
 *
 * Suppose we have some similar code with two possible failures
 */

function flaky() {
  return Math.random() > 0.5;
}

export const example = pipe(
  Z.cond(
    flaky,
    () => "success1" as const,
    () => FooError({ error: "error1" }),
  ),
  Z.flatMap(a =>
    Z.cond(
      flaky,
      () => [a, "success2"] as const,
      () => new BarError("error2"),
    ),
  ),
);

example satisfies Z.Effect<
  never,
  FooError | BarError,
  readonly ["success1", "success2"]
>;

/* If we want to recover from one of those failures, we can use catchTag.
 *
 * This will remove FooError from the E in Effect<R, E, A> and unify the type
 * of the Effect returned from the callback with the Effect we called
 * catchTag on
 */
const catchTagSucceed = Z.catchTag(example, "FooError", e =>
  Z.succeed(["recover", e.error] as const),
);

catchTagSucceed satisfies Z.Effect<
  never,
  BarError,
  readonly ["success1", "success2"] | readonly ["recover", string]
>;

const catchTagFail = Z.catchTag(example, "FooError", e =>
  Z.fail(new BazError(e.error)),
);

catchTagFail satisfies Z.Effect<
  never,
  BarError | BazError,
  readonly ["success1", "success2"]
>;

/* catchTags allows to catch multiple errors from the failure channel */
const catchTags = Z.catchTags(example, {
  FooError: _e => Z.succeed("foo" as const),
  BarError: _e => Z.succeed("bar" as const),
});

catchTags satisfies Z.Effect<
  never,
  never,
  readonly ["success1", "success2"] | "foo" | "bar"
>;

/* If you are integrating Effect in a legacy codebase and you defined
 * errors as tagged unions with a key different from _tag, you can use
 * Effect.catch. The following is equivalent to Effect.catchTag */
const catch_ = Z.catch(example, "_tag", "FooError", e =>
  Z.fail(new BazError(e.error)),
);

catch_ satisfies typeof catchTagFail;

/* catchAll recovers at once from all the errors in the failure channel  */
const catchAll = Z.catchAll(example, e =>
  Z.succeed(["recover", e._tag] as const),
);

catchAll satisfies Z.Effect<
  never,
  never,
  | readonly ["success1", "success2"]
  | readonly ["recover", "FooError" | "BarError"]
>;

/* catchSome recovers from some (or all) errors in the failure channel.
 *
 * Unlike catchAll, or cartchTag, catchSome doesn't narrow the error type, but
 * it can widen it to a broader class of errors.
 *
 * In real world code, you probably always want to use use catchTag instead
 * since it can both narrow and widen the error type.
 */
const catchSome = Z.catchSome(example, e =>
  pipe(
    Match.value(e),
    Match.tag("FooError", e =>
      Z.cond(
        () => e.error === "foo",
        () => "foo" as const,
        () => e,
      ),
    ),
    Match.option,
  ),
);

catchSome satisfies Z.Effect<
  never,
  FooError | BarError,
  readonly ["success1", "success2"] | "foo"
>;

/* Aside from catching failures you can also fallback to other effects.
 * orElse is similar to catchAll but doesn't allow to inspect the error value */
const fallback = Z.orElse(example, () => Z.succeed("foo" as const));

fallback satisfies Z.Effect<
  never,
  never,
  readonly ["success1", "success2"] | "foo"
>;

/*
 * orElseEither uses an Either to store the original success value, or the
 * fallback success value
 */
const fallbackEither = Z.orElseEither(example, () => Z.succeed("foo" as const));

fallbackEither satisfies Z.Effect<
  never,
  never,
  E.Either<readonly ["success1", "success2"], "foo">
>;

/* The last option is folding, known as matching in Effect */
const match = Z.match(
  example,
  e => e._tag,
  x => x[0],
);

match satisfies Z.Effect<never, never, "FooError" | "BarError" | "success1">;

/* Handling Defects
 * ================
 *
 * As mentioned in the original summary, defects are unexpected errors that
 * don't appear in the failure channel (E of Effect<R,E,A>).
 *
 * Even though they don't appear in E, the Effect runtime still keeps track
 * of them in a data structure called Cause.
 *
 * Here are the constructurs for all Cause types:
 */

Cause.empty; // Cause of an Effect that succeeds
Cause.fail; // Cause of an Effect that errors with fail (failure)
Cause.die; // Cause of an Effect that errors with die (defect)
Cause.interrupt; // Cause of an Effect that errors with interrupt
Cause.annotated; // ?
Cause.sequential; // ?
Cause.parallel; // ?

// And with Cause.match you can match a cause by it's type:
Cause.match(
  Cause.empty,
  "empty",
  error => `fail ${error}`,
  defect => `die ${defect}`,
  fiberid => `interrupt ${fiberid}`,
  (value, annotation) => `annotated ${value} ${annotation}`,
  (left, right) => `sequential ${left} ${right}`,
  (left, right) => `parallel ${left} ${right}`,
);

// Effect.cause returns an Effect that succeeds with the argument's Cause, or
// the emtpy Cause if the argument succeeds.
const emptyCause = Z.cause(Z.succeed(1));
emptyCause satisfies Z.Effect<never, never, Cause.Cause<never>>;

const failCause = Z.cause(Z.fail(1));
failCause satisfies Z.Effect<never, never, Cause.Cause<number>>;

/*
 * Since defects are unexpected errors, most of the time you just may want to
 * log them with catchAllCause and logErrorCause:
 */

const dieingExample = pipe(
  example,
  Z.flatMap(() => Z.die("💥")),
);

/*
 * Z.catchAllCause is similar to Z.catchAll but exposes the full Cause<E> in
 * the callback, instead of just E
 */
const catchAllCauseLog = Z.catchAllCause(dieingExample, cause =>
  Z.logErrorCauseMessage("something went wrong", cause),
);

catchAllCauseLog satisfies Z.Effect<never, never, void>;

/*
 * Z.runPromise(catchAllCauseLog) will print a backtrace. i.e:
 *
 * timestamp=2023-02-14T17:19:17.373Z level=ERROR fiber=#0 message="something went wrong" cause="
 * Error: 💥
 *     at 002-errors.ts:233:21
 *     at 002-errors.ts:233:5
 *     at 002-errors.ts:236:28
 */

/* Defect to Failure
 *
 * Effect.absorb and Effect.resurrect allow to recover from defects and
 * transform them into failure discarding all the information about the Cause
 *
 * They have the same type signature, but while absorb onlyy recovers from
 * Defects, resurrect also recovers from Interrupts.
 */

const interruptingExample = pipe(
  example,
  Z.flatMap(() => Z.interrupt()),
);

const absorb = pipe(dieingExample, Z.absorb, Z.ignore);
const resurrect = pipe(interruptingExample, Z.resurrect, Z.ignore);

const successful = pipe(
  absorb,
  Z.flatMap(() => resurrect),
  Z.flatMap(() => Z.succeed("recovered" as const)),
  Z.zipLeft(Z.logInfo("exited successfully")),
);

successful satisfies Z.Effect<never, never, "recovered">;

/* Failure to Defect
 *
 * Effect.refine* combinators allow to convert failures into defects.
 * Their general semantic is to keep some of the failures as such, and covert
 * the others to a defect.
 */

const refineTagOrDie1 = Z.refineOrDie(example, failure =>
  pipe(Match.value(failure), Match.tag("FooError", identity), Match.option),
);

refineTagOrDie1 satisfies Z.Effect<
  never,
  FooError,
  readonly ["success1", "success2"]
>;

/* Sandbox
 *
 * catchSomeCause and catchAllCause are actually shorthands for using
 * sandbox -> catchSome/catchAll -> unsandBox
 *
 * sandbox exposes the full Cause in the failure channel, while unsandbox
 * submerges it.
 */
export const sandboxed = pipe(
  dieingExample,
  Z.sandbox,
  Z.catchSome(_x => O.some(Z.succeed(1))),
  Z.unsandbox,
);
