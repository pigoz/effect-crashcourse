import * as Effect from "@effect/io/Effect";
import * as Schema from "@effect/schema/Schema";
import * as Either from "@effect/data/Either";
import { pipe } from "@effect/data/Function";
import { formatErrors } from "@effect/schema/TreeFormatter";

export class DecodeError {
  readonly _tag = "DecodeError";
  constructor(readonly error: string) {}
}

export function decodeEither<A>(schema: Schema.Schema<A>) {
  return (input: unknown) =>
    pipe(
      Schema.decodeEither(schema)(input, {
        allErrors: true,
        isUnexpectedAllowed: true,
      }),
      Either.mapLeft(_ => new DecodeError(formatErrors(_))),
    );
}

export function decodeAbsolve<A>(schema: Schema.Schema<A>) {
  return (input: unknown) =>
    Effect.absolve(Effect.sync(() => decodeEither(schema)(input)));
}
