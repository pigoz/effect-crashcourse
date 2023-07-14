import { pipe, Effect, ReadonlyArray } from "effect";
import { effectify, effectifyMapError } from "utils/effectify";
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

Effect.runPromise(
  pipe(
    readFile("dadaasd"),
    Effect.map(x => x.toString().split("\n")),
    Effect.map(ReadonlyArray.take(5)),
  ),
)
  .then(x => console.log(x))
  .catch(x => console.error(x));
