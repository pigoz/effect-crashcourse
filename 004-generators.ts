import { pipe, Effect, Context } from "effect";

/* Callback hell.
 *
 * If you have written any JavaScript you have seen it. Sadly, even fp-ts code
 * or other code written in a functional style is not immune to it, even inside
 * high quality codebases.
 */

import { CustomRandomTag } from "001-basic";

export interface Foo {
  readonly foo: number;
}

export const FooTag = Context.Tag<Foo>();

export interface Bar {
  readonly bar: number;
}

export const BarTag = Context.Tag<Bar>();

/*
 * Effect would be very similar - the main issue is any time you have a new
 * dependency in your code, you end up using flatMap and the indentation grows.
 */
export const hell = pipe(
  CustomRandomTag,
  Effect.flatMap(random =>
    pipe(
      FooTag,
      Effect.flatMap(foo =>
        pipe(
          BarTag,
          Effect.flatMap(bar =>
            Effect.sync(() => {
              console.log("please stop!!!", random.next(), foo.foo, bar.bar);
              return "hell" as const;
            }),
          ),
        ),
      ),
    ),
  ),
);

/*
 * For an example so trivial we can actually still get away with the pipe based
 * API using the "all" function built in into Effect.
 */
export const tuple = pipe(
  Effect.all([CustomRandomTag, FooTag, BarTag]),
  Effect.flatMap(([random, foo, bar]) =>
    Effect.sync(() => {
      console.log("not as bad!", random.next(), foo.foo, bar.bar);
      return "tuple" as const;
    }),
  ),
);

// Effect.all preserves the shape of it's argument
export const tuple2 = pipe(
  Effect.all({ random: CustomRandomTag, foo: FooTag, bar: BarTag }),
  Effect.flatMap(({ random, foo, bar }) =>
    Effect.sync(() => {
      console.log("not as bad!", random.next(), foo.foo, bar.bar);
      return "tuple" as const;
    }),
  ),
);

/*
 * But you would still end up with messy code in real application code, not to
 * mention testing code!
 *
 * To address this issue, Effect has an API that uses generators to avoid
 * callback hell.
 */
export const generator = Effect.gen(function* ($) {
  /* NOTE: Unfortunately Effects must be wrapped in this $ function because of
   * shortcomings in the TypeScript language. Someday the TypeScript team might
   * improve how typings in generators work and Effect could drop this $ as a
   * result.
   */
  const random = yield* $(CustomRandomTag);
  const foo = yield* $(FooTag);
  const bar = yield* $(BarTag);

  console.log("this is pretty cool!", random.next(), foo.foo, bar.bar);
  return "generator" as const;
});

/* A legit question would be: How do you error out of a generator function?
 * Just yield a failing Effect
 */
export const generatorerr = Effect.gen(function* ($) {
  const foo = yield* $(FooTag);
  const bar = yield* $(BarTag);

  /* NOTE: The cool part is at least $ can also be used as a pipe so we can
   * shorten $(pipe(var, Effect.map(...))) into $(var, Effect.map(...))
   */
  const random = yield* $(
    CustomRandomTag,
    Effect.map(random => random.next()),
  );

  if (random > 0.5) {
    // Whenever this code block is reached, it will exact this generator
    yield* $(Effect.fail("bad random" as const));
  }

  console.log("this is pretty cool!", random, foo.foo, bar.bar);
  return "generator" as const;
});

/*
 * Another option for avoiding callback hell is "Do notation".
 * This lets you bind effects/values to names when using pipe without
 * introducing more nesting.
 *
 * NOTE: when working with Effect streams, generators don't work. In those
 * instances the Do notation the only option.
 */
export const doNotation = pipe(
  Effect.Do,
  Effect.bind("random", () => CustomRandomTag),
  Effect.bind("foo", () => FooTag),
  Effect.bind("bar", () => BarTag),
  Effect.flatMap(({ random, foo, bar }) =>
    Effect.sync(() =>
      console.log("this is pretty cool!", random.next(), foo.foo, bar.bar),
    ),
  ),
);

/*
 * TLDR: With generators you can write Effect code that looks imperative!
 * It's equivalent to what ZIO does in Scala with for comprehensions.
 *
 * Admittedly, `gen(function* ($) {` and `yield* $(` add quite a bit of noise,
 * but considering the limitations of JavaScript and TypeScript, it's quite
 * amazing that this is possible at all.
 *
 * Code snippets are advised to write out the `gen(function *($)` and `yield* $()`
 * boilerplate. For reference, I setup mine like this:
{
  "Gen Function $": {
    "prefix": "gen$",
    "body": ["function* ($) {\n\t$0\n}"],
    "description": "Generator function with $ input"
  },
  "Gen Function $ (wrapped)": {
    "prefix": "egen$",
    "body": ["Effect.gen(function* ($) {\n\t$0\n})"],
    "description": "Generator function with $ input"
  },
  "Gen Yield $": {
    "prefix": "yield$",
    "body": ["yield* $($0)"],
    "description": "Yield generator calling $()"
  },
  "Gen Yield $ (const)": {
    "prefix": "cyield$",
    "body": ["const $1 = yield* $($0)"],
    "description": "Yield generator calling $()"
  }
}
*/
