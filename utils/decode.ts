import * as S from "@fp-ts/schema";
import * as E from "@fp-ts/core/Either";
import { pipe } from "@fp-ts/core/Function";
import { formatErrors } from "@fp-ts/schema/formatter/Tree";

export function decode<A>(schema: S.Schema<A>) {
  return (input: unknown) =>
    pipe(
      S.decode<A>(schema)(input, {
        allErrors: true,
        isUnexpectedAllowed: true,
      }),
      E.mapLeft(formatErrors),
    );
}
