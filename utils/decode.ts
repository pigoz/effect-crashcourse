import * as E from "@fp-ts/data/Either";
import { z } from "zod";

export function decode<T>(schema: z.ZodSchema<T>) {
  return (input: unknown): E.Either<z.ZodError<T>, T> => {
    const result = schema.safeParse(input);
    if (result.success) {
      return E.right(result.data);
    } else {
      return E.left(result.error);
    }
  };
}
