import { identity, Cause, Effect } from "effect";

const program = Effect.interrupt;

const catchInterrupt = Effect.sandbox(program).pipe(
  Effect.matchEffect({
    onFailure: cause => Effect.fail(Cause.squashWith(cause, identity)),
    onSuccess: Effect.succeed,
  }),
);

console.log(Effect.runPromiseExit(catchInterrupt));
