import { pipe } from "@fp-ts/data/Function";
import * as Z from "@effect/io/Effect";
import * as ZL from "@effect/io/Layer";
import * as Context from "@fp-ts/data/Context";

export interface Foo {
  readonly foo: number;
}

export const Foo = Context.Tag<Foo>();

export interface Bar {
  readonly bar: number;
}
export const Bar = Context.Tag<Bar>();

export const ProgramThatWorksWithEnv = Z.gen(function* ($) {
  const { foo } = yield* $(Z.service(Foo));
  const { bar } = yield* $(Z.service(Bar));
  console.log("foo", foo + 1);
  console.log("bar", bar + 100);
});

const program = ProgramThatWorksWithEnv;

const liveFoo = ZL.succeed(Foo)({ foo: 4 });
const liveBar = ZL.succeed(Bar)({ bar: 2 });

const env = pipe(liveFoo, ZL.merge(liveBar));
const live = pipe(program, Z.provideLayer(env));

Z.unsafeFork(live);
