import { Effect, Either, Data } from "effect";

export class FetchFooError extends Data.TaggedClass("FetchFooError")<{
  readonly error: string;
}> {}

class Foo extends Data.TaggedClass("Foo")<{
  readonly id: number;
}> {}

export function fetchFoo(id: number): Either.Either<FetchFooError, Foo> {
  return id > 2
    ? Either.right(new Foo({ id }))
    : Either.left(new FetchFooError({ error: ":(" }));
}

const program = Effect.partition([0, 1, 2, 3, 4], fetchFoo);

console.log(Effect.runSync(program));
