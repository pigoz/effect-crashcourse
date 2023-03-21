import { pipe } from "@effect/data/Function";
import * as Effect from "@effect/io/Effect";
import * as Schema from "@effect/schema/Schema";
import { parseEither } from "./utils/decode";

/*
 * The most iconic asynchronous example in JavaScript is fetching from APIs.
 * In this example we build a small program to fetch a Gist from Github.
 */

const id = "97459c0045f373f4eaf126998d8f65dc";

/*
 * Here, we use Effect.attemptCatchPromise to wrap a Promise-returning function
 * into an Effect
 *
 * The first argument is a promise returning function, the second is a function
 * that handles the potential exception
 */
const fetchGist = (id: string) =>
  Effect.attemptCatchPromise(
    () => fetch(`https://api.github.com/gists/${id}`),
    () => "fetch" as const,
  ); // Effect.Effect<never, "fetch", Response>

const getJson = (res: Response) =>
  Effect.attemptCatchPromise(
    () => res.json() as Promise<unknown>, // Promise<any> otherwise
    () => "json" as const,
  ); // Effect.Effect<never, "json", unknown>

/*
 * Schema is a library in the Effect ecosystem that allows you to define a
 * type-safe schema for your data
 * It may look familiar if you have used libraries like io-ts or zod
 */
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

// Can get the typescript type from the schema
interface Gist extends Schema.To<typeof GistSchema> {}

const program = pipe(
  // Effect.Effect<never, 'fetch', Response>
  fetchGist(id),

  // Effect.Effect<never, 'fetch' | 'json', unknown>
  Effect.flatMap(getJson),

  // Effect.Effect<never, 'fetch' | 'json', Either<DecodeError, Gist>>
  Effect.map(parseEither(GistSchema)),

  // Effect.Effect<never, 'fetch' | 'json' | DecodeError, Gist>
  Effect.flatMap(Effect.fromEither),
);

Effect.runPromise(program)
  .then(x => console.log("decoded gist %o", x))
  .catch(err => console.error(err));
