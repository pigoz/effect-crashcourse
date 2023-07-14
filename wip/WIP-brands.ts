import * as Brand from "effect/Brand";

export type Eur = number & Brand.Brand<"Eur">;
export const Eur = Brand.nominal<Eur>();

export type Payed = number & Brand.Brand<"Payed">;
export const Payed = Brand.nominal<Payed>();

const payment = Payed(Eur(10));
console.log("euros: %o", payment);
