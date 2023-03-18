import { pipe } from "@effect/data/Function";
import * as Effect from "@effect/io/Effect";
import * as Context from "@effect/data/Context";

/* Callback hell.
 *
 * If you programmed any JavaScript you have seen it. Sadly, even fp code is
 * not immune to it, and even inside high quality codebases, TaskEither based
 * solutions get ugly very quickly. Check this out:
 * https://github.com/pagopa/io-backend/blob/master/src/controllers/ssoController.ts#L75
 */

import { CustomRandom } from "001-basic";

export interface Foo {
  readonly foo: number;
}

export const Foo = Context.Tag<Foo>();

export interface Bar {
  readonly bar: number;
}

export const Bar = Context.Tag<Bar>();

/*
 * Effect would be very similar, the main issue is any time you have a new
 * dependency in your code, you end up using flatMap and the indentation grows.
 * (ndr: In the TaskEither example linked above you can see it in the chain usage)
 * (ndr2: the `hell` type is for documentation purposes, it's not actually needed)
 */
export const hell = pipe(
  Effect.service(CustomRandom),
  Effect.flatMap(random =>
    pipe(
      Effect.service(Foo),
      Effect.flatMap(foo =>
        pipe(
          Effect.service(Bar),
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
 * API using the all combinator built in into Effect.
 */
export const tuple = pipe(
  Effect.all(
    Effect.service(CustomRandom),
    Effect.service(Foo),
    Effect.service(Bar),
  ),
  Effect.flatMap(([random, foo, bar]) =>
    Effect.sync(() => {
      console.log("not as bad!", random.next(), foo.foo, bar.bar);
      return "tuple" as const;
    }),
  ),
);

/*
 * But you would still end up with messy code in real application code,
 * not to mention testing code! OTOH being very generic, library code actually
 * tends to work quite well with the pipe API.
 *
 * To address this issue, the Effect team came up with an API that uses
 * generators to flatten the flatmap callback hell.
 */
export const generator = Effect.gen(function* ($) {
  const random = yield* $(Effect.service(CustomRandom));
  const foo = yield* $(Effect.service(Foo));
  const bar = yield* $(Effect.service(Bar));

  console.log("this is pretty cool!", random.next(), foo.foo, bar.bar);
  return "generator" as const;
});

/* A legit question would be: How do you error out of a generator function?
 * Just yield a failing Effect
 */
export const generatorerr = Effect.gen(function* ($) {
  const random = yield* $(Effect.service(CustomRandom));
  const foo = yield* $(Effect.service(Foo));
  const bar = yield* $(Effect.service(Bar));

  if (random.next() > 0.5) {
    yield* $(Effect.fail("bad random" as const));
  }

  console.log("this is pretty cool!", random.next(), foo.foo, bar.bar);
  return "generator" as const;
});

/*
 * Another option for avoiding callback hell is "Do notation".
 * This lets you bind values/effects to names when using pipe without
 * introducing more nesting.
 *
 * NOTE: when working with Effect streams, generators don't work. In those
 * instances the Do notation the only option.
 */
export const doNotation = pipe(
  Effect.Do(),
  Effect.bind("random", () => Effect.service(CustomRandom)),
  Effect.bind("foo", () => Effect.service(Foo)),
  Effect.bind("bar", () => Effect.service(Bar)),
  Effect.flatMap(({ random, foo, bar }) =>
    Effect.sync(() =>
      console.log("this is pretty cool!", random.next(), foo.foo, bar.bar),
    ),
  ),
);

/*
 * TLDR: With generators you can write Effect code that looks imperative!
 * It's an equivalent to what ZIO does in Scala-land with for comprehensions.
 *
 * Admittedly, `gen(function* ($) {` and `yield* $(` add quite a bit of noise,
 * but considering the limitations of JavaScript and TypeScript, it's quite
 * amazing that this is possible at all.
 *
 *
 * Snippets are advised to write out the `gen(function *($)` and `yield* $()`
 * boilerplate. For reference, I setup mine like this:
{
  "Gen Function $": {
    "prefix": "gen$",
    "body": ["function* ($) {\n\t$0\n}"],
    "description": "Generator function with $ input"
  },
  "Gen Function $ (wrapped)": {
    "prefix": "zgen$",
    "body": ["Effect.gen(function* ($) {\n\t$0\n})"],
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
