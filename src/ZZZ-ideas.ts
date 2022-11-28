// import * as Z from "@effect/io/Effect";

export abstract class random {
  static next: () => number;
}

export class live implements random {
  static next = Math.random;
}

export class test implements random {
  static next = () => 0.3;
}

export interface Class<T> extends Function {
  new (...args: any[]): T;
}

export function service<
  T extends unknown,
  R extends Class<T>,
  A extends Omit<Pick<R, keyof R>, "prototype">
>(x: R): A {
  // @ts-ignore
  return x;
}

// Z.service(random);
