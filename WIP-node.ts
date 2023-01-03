import { pipe } from "@fp-ts/data/Function";
import { effectify } from "utils/effectify";
import * as ReadonlyArray from "@fp-ts/data/ReadonlyArray";
import * as Z from "@effect/io/Effect";
import * as fs from "node:fs";

export const readFile = effectify(fs.readFile);

Z.unsafeRunPromise(
  pipe(
    readFile(__filename),
    Z.map((x) => x.toString().split("\n")),
    Z.map(ReadonlyArray.take(5))
  )
).then((x) => console.log(x));
