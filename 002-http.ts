import { pipe } from "@effect/data/Function";
import * as Effect from "@effect/io/Effect";
import * as Schema from "@effect/schema";
import { decode } from "./utils/decode";

/*
 * The most iconic asynchronous example in JavaScript is fetching from APIs.
 * In this example we build a small program to fetch a Gist.
 */
const fetchGist = (id: string) =>
  Effect.tryCatchPromise(
    () => fetch(`https://api.github.com/gists/${id}`),
    () => "fetch" as const,
  );

const getJson = (res: Response) =>
  Effect.tryCatchPromise(
    () => res.json() as Promise<unknown>, // Promise<any> otherwise
    () => "json" as const,
  );

const GistSchema = Schema.struct({
  url: Schema.string,
  files: Schema.record(
    Schema.string,
    Schema.struct({
      filename: Schema.string,
      type: Schema.string,
      language: Schema.string,
      raw_url: Schema.string,
    }),
  ),
});

interface Gist extends Schema.Infer<typeof GistSchema> {}

const id = "97459c0045f373f4eaf126998d8f65dc";

const program = pipe(
  // Effect.Effect<never, 'fetch', Response>
  fetchGist(id),

  // Effect.Effect<never, 'fetch' | 'json', unknown>
  Effect.flatMap(getJson),

  // Effect.Effect<never, 'fetch' | 'json', Either<DecodeError, Gist>>
  Effect.map(decode<Gist>(GistSchema)),

  // Effect.Effect<never, 'fetch' | 'json' | DecodeError, Gist>
  Effect.flatMap(Effect.fromEither),
);

Effect.runPromise(program)
  .then(x => console.log("decoded gist %o", x))
  .catch(err => console.error(err));
