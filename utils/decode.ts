import * as Effect from "@effect/io/Effect";
import * as Schema from "@effect/schema";
import * as E from "@effect/data/Either";
import { pipe } from "@effect/data/Function";
import { formatErrors } from "@effect/schema/formatter/Tree";

export class DecodeError {
  readonly _tag = "DecodeError";
  constructor(readonly error: string) {}
}

export function decode<A>(schema: Schema.Schema<A>) {
  return (input: unknown) =>
    pipe(
      Schema.decode<A>(schema)(input, {
        allErrors: true,
        isUnexpectedAllowed: true,
      }),
      E.mapLeft(_ => new DecodeError(formatErrors(_))),
    );
}

export function decodeAbsolve<A>(schema: Schema.Schema<A>) {
  return (input: unknown) =>
    Effect.absolve(Effect.sync(() => decode(schema)(input)));
}
