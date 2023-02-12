import * as Z from "@effect/io/Effect";
import * as Data from "@effect/data/Data";
import { pipe } from "@fp-ts/core/Function";

/* Until now we used 'somestring' as const in the failure channel
 * (E in Effect<R, E ,A>) of the example effects we built.
 * That was mainly for readability and to not introduce all the concepts at one.
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

/* Let's move on and use the Errors we defined! :) */

function flaky() {
  return Math.random() > 0.5;
}

/* Suppose we has some similar code with two possible failures */
export const a = pipe(
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
) satisfies Z.Effect<
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
export const a2 = pipe(
  a,
  Z.catchTag("FooError", e => Z.succeed(["recover", e.error] as const)),
) satisfies Z.Effect<
  never,
  BarError,
  readonly ["success1", "success2"] | readonly ["recover", string]
>;

export const a3 = pipe(
  a,
  Z.catchTag("FooError", e => Z.fail(new BazError(e.error))),
) satisfies Z.Effect<
  never,
  BarError | BazError,
  readonly ["success1", "success2"]
>;

/* Note: if you are integrating Effect in a legacy codebase and you defined
 * errors as tagged unions with a key different from _tag, you can use
 * Effect.catch. The following is equivalent to Effect.catchTag */
export const b = pipe(
  a,
  Z.catch("_tag", "FooError", e => Z.fail(new BazError(e.error))),
) satisfies typeof a3;

/* TODO */

Z.catchAll;
/* doesn't recover from unrecoverable error (what's unrecoverable? Effect.die?).
 * Use catchAllCause to catch unrecoverable errors */

Z.catchSome; // ?

/*
 * Cause (https://zio.dev/reference/core/cause/)
 */
Z.catchAllCause(Z.logErrorCause);

Z.absorb; // what's the use of this?: Effect<R, E, A> -> Effect<R, unknown, A>
Z.sandbox; // ? Exposes Cause:  Effect<R, E, A> -> Effect<R, Cause<E>, A>
Z.mapErrorCause; // ?
