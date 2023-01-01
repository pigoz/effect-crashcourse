import { pipe } from "@fp-ts/data/Function";
import * as Z from "@effect/io/Effect";
import { z } from "zod"; // waiting patiently for @fp-ts/schema
import { decode } from "utils/decode";

/*
 * The most iconic asynchronous example in JavaScript is fetching from APIs.
 * In this example we build a small program to fetch a Gist.
 */
const fetchGist = (id: string) =>
  Z.tryCatchPromise(
    () => fetch(`https://api.github.com/gists/${id}`),
    () => "fetch" as const
  );

const getJson = (res: Response) =>
  Z.tryCatchPromise(
    () => res.json() as Promise<unknown>, // Promise<any> otherwise
    () => "json" as const
  );

const GistDecoder = z.object({
  url: z.string(),
  files: z.record(
    z.string(),
    z.object({
      filename: z.string(),
      type: z.string(),
      language: z.string(),
      raw_url: z.string(),
    })
  ),
});

export type Gist = z.infer<typeof GistDecoder>;

const id = "97459c0045f373f4eaf126998d8f65dc";

const program = pipe(
  // Z.Effect<never, 'fetch', Response>
  fetchGist(id),

  // Z.Effect<never, 'fetch' | 'json', unknown>
  Z.flatMap(getJson),

  // Z.Effect<never, 'fetch' | 'json', Either<ZodError, Gist>>
  Z.map(decode<Gist>(GistDecoder)),

  // Z.Effect<never, 'fetch' | 'json' | ZodError, Gist>
  Z.flatMap(Z.fromEither)
);

Z.unsafeRunPromise(program).then((x) => console.log("decoded gist", x));
