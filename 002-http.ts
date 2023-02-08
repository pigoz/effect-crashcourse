import { pipe } from "@fp-ts/core/Function";
import * as Z from "@effect/io/Effect";
import * as S from "@fp-ts/schema";
import { decode } from "./utils/decode";

/*
 * The most iconic asynchronous example in JavaScript is fetching from APIs.
 * In this example we build a small program to fetch a Gist.
 */
const fetchGist = (id: string) =>
  Z.tryCatchPromise(
    () => fetch(`https://api.github.com/gists/${id}`),
    () => "fetch" as const,
  );

const getJson = (res: Response) =>
  Z.tryCatchPromise(
    () => res.json() as Promise<unknown>, // Promise<any> otherwise
    () => "json" as const,
  );

const GistSchema = S.struct({
  url: S.string,
  files: S.record(
    S.string,
    S.struct({
      filename: S.string,
      type: S.string,
      language: S.string,
      raw_url: S.string,
    }),
  ),
});

interface Gist extends S.Infer<typeof GistSchema> {}

const id = "97459c0045f373f4eaf126998d8f65dc";

const program = pipe(
  // Z.Effect<never, 'fetch', Response>
  fetchGist(id),

  // Z.Effect<never, 'fetch' | 'json', unknown>
  Z.flatMap(getJson),

  // Z.Effect<never, 'fetch' | 'json', Either<ZodError, Gist>>
  Z.map(decode<Gist>(GistSchema)),

  // Z.Effect<never, 'fetch' | 'json' | ZodError, Gist>
  Z.flatMap(Z.fromEither),
);

Z.runPromise(program)
  .then(x => console.log("decoded gist %o", x))
  .catch(err => console.error(err));
