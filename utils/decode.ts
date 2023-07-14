import * as Schema from "@effect/schema/Schema";
import { formatErrors } from "@effect/schema/TreeFormatter";
import { Either } from "effect";

export class DecodeError {
  readonly _tag = "DecodeError";
  constructor(readonly error: string) {}
}

export function parseEither<_, A>(schema: Schema.Schema<_, A>) {
  return (input: unknown) =>
    Schema.parseEither(schema)(input, { errors: "all" }).pipe(
      Either.mapLeft(
        parseError => new DecodeError(formatErrors(parseError.errors)),
      ),
    );
}
