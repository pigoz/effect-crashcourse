import { pipe } from "@fp-ts/data/Function";
import { effectify } from "utils/effectify";
import * as ReadonlyArray from "@fp-ts/data/ReadonlyArray";
import * as Z from "@effect/io/Effect";
import * as fs from "node:fs";

export const readFile = effectify(fs.readFile);

import { promisify } from "node:util";

type CustomPromisifySymbolExample = {
  (x: number, cb: (err: number, data: string) => void): void;
  [promisify.custom]: () => Promise<string>;
};

const customSymbol: CustomPromisifySymbolExample = (() => {}) as any;

function foo(x: number, cb: (err: number, data: string) => void) {}

const x = effectify(customSymbol);

const y = effectify(foo);

Z.unsafeRunPromise(
  pipe(
    readFile(__filename),
    Z.map((x) => x.toString().split("\n")),
    Z.map(ReadonlyArray.take(5))
  )
).then((x) => console.log(x));
