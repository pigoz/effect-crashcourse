import { Effect, Cause, Data, Chunk } from "effect";
import * as S from "@effect/schema/Schema";

export class UnauthorizedError extends Data.TaggedClass("UnauthorizedError")<{
  readonly error: string;
}> {}

const program = Effect.fail(new UnauthorizedError({ error: ":(" })).pipe(
  Effect.orDie,
);

const UnauthorizedErrorSchema = S.struct({
  _tag: S.literal("UnauthorizedError"),
});

const redirectToLogin = Effect.fail("TODO");

const catchUnauthorized = Effect.sandbox(program).pipe(
  Effect.matchEffect({
    onFailure: cause =>
      Chunk.some(Cause.defects(cause), S.is(UnauthorizedErrorSchema))
        ? redirectToLogin
        : Effect.failCause(cause),
    onSuccess: Effect.succeed,
  }),
);

console.log(Effect.runPromiseExit(catchUnauthorized));
