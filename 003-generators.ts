import { pipe } from "@fp-ts/core/Function";
import * as Z from "@effect/io/Effect";
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
type hell = Z.Effect<CustomRandom | Foo | Bar, never, "hell">;
export const hell: hell = pipe(
  Z.service(CustomRandom),
  Z.flatMap(random =>
    pipe(
      Z.service(Foo),
      Z.flatMap(foo =>
        pipe(
          Z.service(Bar),
          Z.flatMap(bar =>
            Z.sync(() => {
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
 * API using the tuple combinator built in into Effect.
 */
type purgatory = Z.Effect<CustomRandom | Foo | Bar, never, "purgatory">;
export const purgatory: purgatory = pipe(
  Z.tuple(Z.service(CustomRandom), Z.service(Foo), Z.service(Bar)),
  Z.flatMap(([random, foo, bar]) =>
    Z.sync(() => {
      console.log("not as bad!", random.next(), foo.foo, bar.bar);
      return "purgatory" as const;
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
type paradise = Z.Effect<CustomRandom | Foo | Bar, never, "paradise">;
export const paradise: paradise = Z.gen(function* ($) {
  const random = yield* $(Z.service(CustomRandom));
  const foo = yield* $(Z.service(Foo));
  const bar = yield* $(Z.service(Bar));

  console.log("this is pretty cool!", random.next(), foo.foo, bar.bar);
  return "paradise" as const;
});

/* A legit question would be: How do you error out of a generator function?
 * Just yield a failing Effect
 */
type paradiseErr = Z.Effect<CustomRandom | Foo | Bar, "bad random", "paradise">;
export const paradiseErr: paradiseErr = Z.gen(function* ($) {
  const random = yield* $(Z.service(CustomRandom));
  const foo = yield* $(Z.service(Foo));
  const bar = yield* $(Z.service(Bar));

  if (random.next() > 0.5) {
    yield* $(Z.fail("bad random" as const));
  }

  console.log("this is pretty cool!", random.next(), foo.foo, bar.bar);
  return "paradise" as const;
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
  Z.Do(),
  Z.bind("random", () => Z.service(CustomRandom)),
  Z.bind("foo", () => Z.service(Foo)),
  Z.bind("bar", () => Z.service(Bar)),
  Z.flatMap(({ random, foo, bar }) =>
    Z.sync(() =>
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
    "body": ["Z.gen(function* ($) {\n\t$0\n})"],
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
