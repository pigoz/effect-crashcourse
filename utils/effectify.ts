import * as Z from "@effect/io/Effect";
import { F as Fn, List } from "ts-toolbelt";

type Callback<E, A> = (e: E, a: A) => void;

export interface CustomEffectify<TCustom extends Fn.Function> extends Function {
  __promisify__: TCustom;
}

export type UnwrapPromise<T> = T extends Promise<infer A> ? A : never;

export function effectify<
  F extends Fn.Function,
  Cb = List.Last<Fn.Parameters<F>>,
  E = Cb extends Fn.Function ? NonNullable<Fn.Parameters<Cb>[0]> : never
>(
  fn: F
): (
  ...args: F extends CustomEffectify<infer TCustom>
    ? Fn.Parameters<TCustom>
    : never[]
) => Z.Effect<
  never,
  E,
  F extends CustomEffectify<infer TCustom>
    ? UnwrapPromise<Fn.Return<TCustom>>
    : never
>;

export function effectify<E, A>(
  fn: (cb: Callback<E, A>) => void
): () => Z.Effect<never, NonNullable<E>, A>;

export function effectify<E, A, X1>(
  fn: (x1: X1, cb: Callback<E, A>) => void
): (x1: X1) => Z.Effect<never, NonNullable<E>, A>;

export function effectify<E, A, X1, X2>(
  fn: (x1: X1, x2: X2, cb: Callback<E, A>) => void
): (x1: X1, x2: X2) => Z.Effect<never, NonNullable<E>, A>;

export function effectify<E, A, X1, X2, X3>(
  fn: (x1: X1, x2: X2, x3: X3, cb: Callback<E, A>) => void
): (x1: X1, x2: X2, x3: X3) => Z.Effect<never, NonNullable<E>, A>;

export function effectify<E, A, X1, X2, X3, X4>(
  fn: (x1: X1, x2: X2, x3: X3, x4: X4, cb: Callback<E, A>) => void
): (x1: X1, x2: X2, x3: X3, x4: X4) => Z.Effect<never, NonNullable<E>, A>;

export function effectify<E, A, X1, X2, X3, X4, X5>(
  fn: (x1: X1, x2: X2, x3: X3, x4: X4, x5: X5, cb: Callback<E, A>) => void
): (
  x1: X1,
  x2: X2,
  x3: X3,
  x4: X4,
  x5: X5
) => Z.Effect<never, NonNullable<E>, A>;

export function effectify(fn: Function) {
  return (...args: any[]) =>
    Z.async<never, unknown, unknown>((resume) => {
      fn(...args, (error: unknown, data: unknown) => {
        if (error) {
          resume(Z.fail(error));
        } else {
          resume(Z.succeed(data));
        }
      });
    });
}
