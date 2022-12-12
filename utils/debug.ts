import { pipe } from "@fp-ts/data/Function";
import * as Z from "@effect/io/Effect";

/* stupid alternative to traced */
export const logged =
  (message: string) =>
  <R1, E1, A1>(e: Z.Effect<R1, E1, A1>): Z.Effect<R1, E1, A1> => {
    return pipe(
      e,
      Z.tap((a) => {
        a !== undefined ? console.log(message, a) : console.log(message);
        return Z.succeed(a);
      })
    );
  };
