import * as Effect from "@effect/io/Effect";
import { CustomPromisifyLegacy, CustomPromisifySymbol } from "node:util";

type Callback<E, A> = (e: E, a: A) => void;

type Fn = (...args: any) => any;

export type CustomPromisify<TCustom extends Fn> =
  | CustomPromisifySymbol<TCustom>
  | CustomPromisifyLegacy<TCustom>;

type Parameters<F extends Function> = F extends (...args: infer P) => any
  ? P
  : never;

export type Length<L extends unknown[]> = L["length"];

export type Tail<L extends unknown[]> = L extends readonly []
  ? L
  : L extends readonly [unknown?, ...infer LTail]
  ? LTail
  : L;

export type Last<L extends unknown[]> = L[Length<Tail<L>>];

export type UnwrapPromise<T> = T extends Promise<infer A> ? A : never;

export function effectify<
  X extends Fn,
  F extends CustomPromisify<X>,
  Cb = Last<Parameters<F>>,
  E = Cb extends Function ? NonNullable<Parameters<Cb>[0]> : never,
>(
  fn: F,
): (
  ...args: F extends CustomPromisify<infer TCustom>
    ? Parameters<TCustom>
    : never[]
) => Effect.Effect<
  never,
  E,
  F extends CustomPromisify<infer TCustom>
    ? UnwrapPromise<ReturnType<TCustom>>
    : never
>;

export function effectify<E, A>(
  fn: (cb: Callback<E, A>) => void,
): () => Effect.Effect<never, NonNullable<E>, A>;

export function effectify<E, A, X1>(
  fn: (x1: X1, cb: Callback<E, A>) => void,
): (x1: X1) => Effect.Effect<never, NonNullable<E>, A>;

export function effectify<E, A, X1, X2>(
  fn: (x1: X1, x2: X2, cb: Callback<E, A>) => void,
): (x1: X1, x2: X2) => Effect.Effect<never, NonNullable<E>, A>;

export function effectify<E, A, X1, X2, X3>(
  fn: (x1: X1, x2: X2, x3: X3, cb: Callback<E, A>) => void,
): (x1: X1, x2: X2, x3: X3) => Effect.Effect<never, NonNullable<E>, A>;

export function effectify<E, A, X1, X2, X3, X4>(
  fn: (x1: X1, x2: X2, x3: X3, x4: X4, cb: Callback<E, A>) => void,
): (x1: X1, x2: X2, x3: X3, x4: X4) => Effect.Effect<never, NonNullable<E>, A>;

export function effectify<E, A, X1, X2, X3, X4, X5>(
  fn: (x1: X1, x2: X2, x3: X3, x4: X4, x5: X5, cb: Callback<E, A>) => void,
): (
  x1: X1,
  x2: X2,
  x3: X3,
  x4: X4,
  x5: X5,
) => Effect.Effect<never, NonNullable<E>, A>;

export function effectify(fn: Function) {
  return (...args: any[]) =>
    Effect.async<never, unknown, unknown>(resume => {
      fn(...args, (error: unknown, data: unknown) => {
        if (error) {
          resume(Effect.fail(error));
        } else {
          resume(Effect.succeed(data));
        }
      });
    });
}

export function effectifyMapError<
  X extends Fn,
  F extends CustomPromisify<X>,
  E2,
  Cb = Last<Parameters<F>>,
  E1 = Cb extends Function ? NonNullable<Parameters<Cb>[0]> : never,
>(
  fn: F,
  mapError: (e: E1) => E2,
): (
  ...args: F extends CustomPromisify<infer TCustom>
    ? Parameters<TCustom>
    : never[]
) => Effect.Effect<
  never,
  E2,
  F extends CustomPromisify<infer TCustom>
    ? UnwrapPromise<ReturnType<TCustom>>
    : never
>;

export function effectifyMapError<E1, E2, A>(
  fn: (cb: Callback<E1, A>) => void,
  mapError: (e: NonNullable<E1>) => E2,
): () => Effect.Effect<never, E2, A>;

export function effectifyMapError<E1, E2, A, X1>(
  fn: (x1: X1, cb: Callback<E1, A>) => void,
  mapError: (e: NonNullable<E1>) => E2,
): (x1: X1) => Effect.Effect<never, E2, A>;

export function effectifyMapError<E1, E2, A, X1, X2>(
  fn: (x1: X1, x2: X2, cb: Callback<E1, A>) => void,
  mapError: (e: NonNullable<E1>) => E2,
): (x1: X1, x2: X2) => Effect.Effect<never, NonNullable<E2>, A>;

export function effectifyMapError<E1, E2, A, X1, X2, X3>(
  fn: (x1: X1, x2: X2, x3: X3, cb: Callback<E2, A>) => void,
  mapError: (e: NonNullable<E1>) => E2,
): (x1: X1, x2: X2, x3: X3) => Effect.Effect<never, E2, A>;

export function effectifyMapError<E1, E2, A, X1, X2, X3, X4>(
  fn: (x1: X1, x2: X2, x3: X3, x4: X4, cb: Callback<E1, A>) => void,
  mapError: (e: NonNullable<E1>) => E2,
): (x1: X1, x2: X2, x3: X3, x4: X4) => Effect.Effect<never, E2, A>;

export function effectifyMapError<E1, E2, A, X1, X2, X3, X4, X5>(
  fn: (x1: X1, x2: X2, x3: X3, x4: X4, x5: X5, cb: Callback<E1, A>) => void,
  mapError: (e: NonNullable<E1>) => E2,
): (x1: X1, x2: X2, x3: X3, x4: X4, x5: X5) => Effect.Effect<never, E2, A>;

export function effectifyMapError(fn: Function, mapError: Function) {
  return (...args: any[]) =>
    Effect.async<never, unknown, unknown>(resume => {
      fn(...args, (error: unknown, data: unknown) => {
        if (error) {
          resume(Effect.fail(mapError(error)));
        } else {
          resume(Effect.succeed(data));
        }
      });
    });
}
