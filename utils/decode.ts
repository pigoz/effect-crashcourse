import * as Schema from "@effect/schema/Schema";
import * as Either from "@effect/data/Either";
import { pipe } from "@effect/data/Function";
import { formatErrors } from "@effect/schema/TreeFormatter";

export class DecodeError {
  readonly _tag = "DecodeError";
  constructor(readonly error: string) {}
}

export function parseEither<_, A>(schema: Schema.Schema<_, A>) {
  return (input: unknown) =>
    pipe(
      Schema.parseEither(schema)(input, { errors: "all" }),
      Either.mapLeft(
        parseError => new DecodeError(formatErrors(parseError.errors)),
      ),
    );
}
