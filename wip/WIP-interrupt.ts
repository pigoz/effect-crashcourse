import { identity } from "@effect/data/Function";
import * as Cause from "@effect/io/Cause";
import * as Effect from "@effect/io/Effect";

const program = Effect.interrupt;

const catchInterrupt = Effect.sandbox(program).pipe(
  Effect.matchEffect({
    onFailure: cause => Effect.fail(Cause.squashWith(cause, identity)),
    onSuccess: Effect.succeed,
  }),
);

console.log(Effect.runPromiseExit(catchInterrupt));
