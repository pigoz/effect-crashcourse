import { identity, pipe, Effect, Cause, Data, Option, Equal } from "effect";
import * as Match from "@effect/match";

/*
 * Effect has 3 main types of errors:
 *
 * 1) Failure
 * Generated using Effect.fail and appears in the E type of Effect<R, E, A>
 * (which is also known as the failure channel).
 *
 * These are also called 'expected errors' or 'typed errors' or 'recoverable errors'.
 *
 * They are errors which the developer expects to happen, part of the domain,
 * and part of the program's control flow.
 *
 * In spirit they are similar to checked exceptions.
 *
 * 2) Defect
 * Generated using Effect.die (and some other similar functions), they don't
 * appear in the Effect<R,E,A> type.
 *
 * Also known as 'unexpected errors' or 'untyped errors' or 'unrecoverable errors'.
 * (NOTE: despite the name there are ways to recover from them but it's way
 * more verbose compared to failures).
 *
 * These are unexpected errors which are not part of the domain, nor the
 * control flow.
 *
 * While it doesn't appear in the type Effect<R,E,A>, the Effect runtime keeps
 * track of these errors in a data structure called Cause (more on this later),
 * and there are functions that allow you to access the Cause and analyze it.
 *
 * In spirit, similar to unchecked exceptions.
 *
 * 3) Interruption
 * Generated with Effect.interrupt to interrupt the executing Fiber, or
 * Fiber.interrupt(fiber) to interrupt a `fiber`. We will talk more about
 * fibers later.
 *
 * An interruption will cause the fiber to return an Exit.Failure containing
 * a Cause.interrupt.
 */

/* Building Errors
 * ===============
 *
 * Until now we used string literals in the failure channel of the example
 * effects we built. That was mainly for easing you into the concepts.
 *
 * In reality it's better to fail with an object that has a _tag field.
 * This is because Effect comes with a few functions built specifically to
 * handle "tagged" error objects in a typesafe way (i.e. catchTag).
 *
 * To define such errors you can use:
 *  - interface extending Data.Case in combination with Data.tagged
 *  - plain Typescript interfaces
 *
 *  - Data.TaggedClass
 *  - plain Typescript classes
 */

// interface extending Data.Case in combination with Data.TaggedClass
// NOTE: this is the most convenient option if you want to use interfaces
export interface FooError extends Data.Case {
  readonly _tag: "FooError";
  readonly error: string;
}

export const FooError = Data.tagged<FooError>("FooError");

// plain Typescript interfaces with corresponding constructor
// NOTE: this is the minimalist option if you want to use interfaces
export interface BatError {
  readonly _tag: "BatError";
  readonly error: unknown;
}

export const BatError = (error: unknown): BatError => ({
  _tag: "BatError",
  error,
});

// Data.TaggedClass
// most concise option using classes
export class FooErrorClass extends Data.TaggedClass("FooError")<{
  readonly error: string;
}> {}

// plain Typescript classes
export class BarError {
  readonly _tag = "BarError";
  constructor(readonly error: string) {}
}

export class BazError {
  readonly _tag = "BazError";
  constructor(readonly error: string) {}
}

/*
 * The nice thing about using classes is you can define the type and
 * constructor in one go. But many people dislike them, so it's your choice
 * which option to use.
 *
 * Errors defined through Data have the added benefit of providing an Equal
 * implementation. That allows to compare errors by value instead of reference.
 */

// This is true because the argument to FooError is compared by value
export const isEqual = Equal.equals(
  FooError({ error: "foo1" }),
  FooError({ error: "foo1" }),
);

export const isEqualClass = Equal.equals(
  new FooErrorClass({ error: "foo1" }),
  new FooErrorClass({ error: "foo1" }),
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
  Effect.if(flaky(), {
    onTrue: Effect.succeed("success1" as const),
    onFalse: Effect.fail(FooError({ error: "error1" })),
  }),
  Effect.flatMap(a =>
    Effect.if(flaky(), {
      onTrue: Effect.succeed([a, "success2"] as const),
      onFalse: Effect.fail(new BarError("error2")),
    }),
  ),
);

example satisfies Effect.Effect<
  never,
  FooError | BarError,
  readonly ["success1", "success2"]
>;

/* If we want to recover from one of those failures, we can use catchTag.
 *
 * This will remove FooError from the E in Effect<R, E, A> in `example`,
 * and unify the return type of the callback with `example`.
 */
const catchTagSucceed = Effect.catchTag(example, "FooError", e =>
  Effect.succeed(["recover", e.error] as const),
);

// Notice how FooError disappeared from the E type, and A now has a union of
// the two possible return types
catchTagSucceed satisfies Effect.Effect<
  never,
  BarError,
  readonly ["success1", "success2"] | readonly ["recover", string]
>;

// Here, we caught FooError but returned another error called BazError!
// Now the E type has both BarError and BazError, and A didn't change
const catchTagFail = Effect.catchTag(example, "FooError", e =>
  Effect.fail(new BazError(e.error)),
);

catchTagFail satisfies Effect.Effect<
  never,
  BarError | BazError,
  readonly ["success1", "success2"]
>;

/* catchTags allows to catch multiple errors from the failure channel */
// we handled both errors and returned a string literal, which is now part of
// the A type
const catchTags = Effect.catchTags(example, {
  FooError: _e => Effect.succeed("foo" as const),
  BarError: _e => Effect.succeed("bar" as const),
});

catchTags satisfies Effect.Effect<
  never,
  never,
  readonly ["success1", "success2"] | "foo" | "bar"
>;

/* If you are integrating Effect in a legacy codebase and you defined
 * errors as tagged unions with a key different from _tag, you can use
 * Effect.catch. The following is equivalent to Effect.catchTag */
const catchCustomTag = Effect.catch(example, "_tag", {
  failure: "FooError",
  onFailure: e => Effect.fail(new BazError(e.error)),
});

catchCustomTag satisfies typeof catchTagFail;

/* catchAll recovers at once from all the errors in the failure channel.
 * You can use it to perform custom matching on errors in case you are not
 * using tagged unions.
 *
 * Observe how the A type perfectly maintains the possible return types
 *
 * NOTE: In the Effect internals, catchTag is built on top of catchAll!
 */
const catchAll = Effect.catchAll(example, e =>
  Effect.succeed(["recover", e._tag] as const),
);

catchAll satisfies Effect.Effect<
  never,
  never,
  | readonly ["success1", "success2"]
  | readonly ["recover", "FooError" | "BarError"]
>;

/* catchSome recovers from some (or all) errors in the failure channel.
 *
 * Unlike catchAll, or catchTag, catchSome doesn't narrow the error type, but
 * it can widen it to a broader class of errors.
 *
 * In real world code, you probably always want to use use catchTag instead
 * since it can both narrow and widen the error type.
 */

const catchSome = Effect.catchSome(example, e =>
  pipe(
    Match.value(e),
    Match.tag("FooError", _ => Effect.succeed("foo" as const)),
    Match.option,
  ),
);

// Note: Match (@effect/match) is a pattern matching library from the Effect
// ecosystem

catchSome satisfies Effect.Effect<
  never,
  FooError | BarError,
  readonly ["success1", "success2"] | "foo"
>;

/* orElse* functions are similar to catchAll but on top of failures they
 * also catch interruptions.
 *
 * Notice how E is now the never type, and A is a union of the two possible
 * return types
 */
const fallback = Effect.orElse(example, () => Effect.succeed("foo" as const));

fallback satisfies Effect.Effect<
  never,
  never,
  readonly ["success1", "success2"] | "foo"
>;

/* The last option is folding, known as matching in Effect */
const match = Effect.match(example, {
  onFailure: error => error._tag,
  onSuccess: success => success[0],
});

match satisfies Effect.Effect<
  never,
  never,
  "FooError" | "BarError" | "success1"
>;

/* Handling Defects
 * ================
 *
 * As mentioned in the original summary, defects are unexpected errors that
 * don't appear in the failure channel (E of Effect<R,E,A>).
 *
 * Even though they don't appear in E, the Effect runtime still keeps track
 * of them in a data structure called Cause.
 *
 * Here are the constructors for all Cause types:
 */

Cause.empty; // Cause of an Effect that succeeds
Cause.fail; // Cause of an Effect that errors with fail (failure)
Cause.die; // Cause of an Effect that errors with die (defect)
Cause.interrupt; // Cause of an Effect that errors with interrupt
Cause.annotated; // represents a cause with metadata (for example the stack trace)
Cause.sequential; // represents two errors that have occurred in sequence
Cause.parallel; // represents two errors that have occurred in parallel

// And with Cause.match you can match a cause by it's type:
Cause.match(Cause.empty, {
  onEmpty: "empty",
  onFail: error => `fail ${error}`,
  onDie: defect => `die ${defect}`,
  onInterrupt: fiberid => `interrupt ${fiberid}`,
  onAnnotated: (value, annotation) => `annotated ${value} ${annotation}`,
  onSequential: (left, right) => `sequential ${left} ${right}`,
  onParallel: (left, right) => `parallel ${left} ${right}`,
});

// Effect.cause returns an Effect that succeeds with the argument's Cause, or
// the empty Cause if the argument succeeds.
const emptyCause = Effect.cause(Effect.succeed(1));
emptyCause satisfies Effect.Effect<never, never, Cause.Cause<never>>;

const failCause = Effect.cause(Effect.fail(1));
failCause satisfies Effect.Effect<never, never, Cause.Cause<number>>;

/*
 * Since defects are unexpected errors, most of the time you just may want to
 * log them with catchAllCause and logErrorCause:
 */

const dieExample = pipe(
  example,
  Effect.flatMap(() => Effect.die("💥")),
);

/*
 * Effect.catchAllCause is similar to Effect.catchAll but exposes the full
 * Cause<E> in the callback, instead of just E
 */
const catchAllCauseLog = Effect.catchAllCause(
  dieExample,
  Effect.logCause({ message: "something went wrong" }),
);

catchAllCauseLog satisfies Effect.Effect<never, never, void>;

/*
 * Effect.runPromise(catchAllCauseLog) will print a stack trace. i.e:
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
 * They have the same type signature, but while absorb only recovers from
 * Defects, resurrect also recovers from Interrupts.
 */

const catchDie = pipe(
  dieExample,
  Effect.catchAllDefect(_ => Effect.fail(_)),
  Effect.ignore,
);

const successful = pipe(
  Effect.zipRight(catchDie, Effect.succeed("recovered" as const)),
  Effect.zipLeft(Effect.log("exited successfully")),
);

/*
 * Note: Effect.zipLeft(a, b) combines (zips) a and b in a single Effect that
 * runs a and b sequentially, and returns the return value of a.
 *
 * Here it's used to run logInfo but discard it's result.
 */

successful satisfies Effect.Effect<never, never, "recovered">;

/* Sandbox
 *
 * catchSomeCause and catchAllCause are actually shorthands for using
 * sandbox -> catchSome/catchAll -> unsandbox
 *
 * sandbox exposes the full Cause in the failure channel (E), while unsandbox
 * submerges it.
 */
export const sandboxed = pipe(
  dieExample,
  Effect.sandbox,
  Effect.catchSome(_errorCause => Option.some(Effect.succeed(1))),
  Effect.unsandbox,
);

/*
 * With sandbox you can recover from both Defects and Interrupts.
 * The following is equivalent to ZIOs absorb:
 */
export function absorb<R, E, A>(self: Effect.Effect<R, E, A>) {
  return Effect.sandbox(self).pipe(
    Effect.matchEffect({
      onFailure: cause => Effect.fail(Cause.squashWith(cause, identity)),
      onSuccess: Effect.succeed,
    }),
  );
}
