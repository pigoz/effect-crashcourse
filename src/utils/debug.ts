import { pipe } from "@fp-ts/data/Function";
import * as Z from "@effect/io/Effect";
import * as ZL from "@effect/io/Layer";
import * as Context from "@fp-ts/data/Context";
import debug_ from "debug";

export interface Foo {
  readonly int: number;
}

type X = number;

export const X = Context.Tag<X>();

export const debug =
  (namespace: string) =>
  (formatter: string, ...args: unknown[]) =>
    Z.sync(() => {
      debug_(namespace)(formatter, ...args);
    });
