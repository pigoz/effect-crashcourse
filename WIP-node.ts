import { pipe } from "@fp-ts/core/Function";
import { effectify, effectifyMapError } from "utils/effectify";
import * as ReadonlyArray from "@fp-ts/core/ReadonlyArray";
import * as Z from "@effect/io/Effect";
import * as fs from "node:fs";
import { promisify } from "node:util";

export class ReadFileError {
  readonly _tag = "ReadFileError";
  constructor(readonly error: NodeJS.ErrnoException) {}
}

export const readFile = effectifyMapError(
  fs.readFile,
  e => new ReadFileError(e),
);

type CustomPromisifySymbolExample = {
  (x: number, cb: (err: number, data: string) => void): void;
  [promisify.custom]: () => Promise<string>;
};

const customSymbol: CustomPromisifySymbolExample = (() => {}) as any;

function foo(x: number, cb: (err: number, data: string) => void) {}

const x = effectify(customSymbol);

const y = effectify(foo);

Z.runPromise(
  pipe(
    readFile("dadaasd"),
    Z.map(x => x.toString().split("\n")),
    Z.map(ReadonlyArray.take(5)),
  ),
)
  .then(x => console.log(x))
  .catch(x => console.error(x));
