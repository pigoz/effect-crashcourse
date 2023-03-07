import * as Z from "@effect/io/Effect";
import * as S from "@effect/schema";
import * as E from "@effect/data/Either";
import { pipe } from "@effect/data/Function";
import { formatErrors } from "@effect/schema/formatter/Tree";

export class DecodeError {
  readonly _tag = "DecodeError";
  constructor(readonly error: string) {}
}

export function decode<A>(schema: S.Schema<A>) {
  return (input: unknown) =>
    pipe(
      S.decode<A>(schema)(input, {
        allErrors: true,
        isUnexpectedAllowed: true,
      }),
      E.mapLeft(_ => new DecodeError(formatErrors(_))),
    );
}

export function decodee<A>(schema: S.Schema<A>) {
  return (input: unknown) => Z.absolve(Z.sync(() => decode(schema)(input)));
}
