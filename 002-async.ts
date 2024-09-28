import { Schema } from "@effect/schema";
import { Effect, pipe } from "effect";
/*
 * The most iconic asynchronous example in JavaScript is fetching from APIs.
 * In this example we build a small program to fetch a Gist from Github.
 */

const id = "97459c0045f373f4eaf126998d8f65dc";

/*
 * Here, we use Effect.attemptCatchPromise to wrap a Promise-returning function
 * into an Effect
 *
 * The first argument is a callback that returns the Promise to wrap.
 *
 * The second is a callback that returns a value to put in the error channel
 * (E in Effect<R, E, A>) in case the Promise throws an exception.
 */
const fetchGist = (id: string) =>
  Effect.tryPromise({
    try: () => fetch(`https://api.github.com/gists/${id}`),
    catch: () => "fetch" as const,
  }); // Effect.Effect<Response, "fetch">

const getJson = (res: Response) =>
  Effect.tryPromise({
    try: () => res.json() as Promise<unknown>, // Promise<any> otherwise
    catch: () => "json" as const,
  }); // Effect.Effect<unknown, "json">

/*
 * Schema is a library in the Effect ecosystem that allows you to parse and
 * encode data in a type-safe way.
 *
 * It may look familiar if you have used libraries like io-ts or zod
 */
const Gist = Schema.Struct({
  url: Schema.String,
  files: Schema.Record({
    key: Schema.String,
    value: Schema.Struct({
      filename: Schema.String,
      type: Schema.String,
      language: Schema.String,
      raw_url: Schema.String,
    }),
  }),
});

// Can get the typescript type from the schema
export interface Gist extends Schema.Schema.Type<typeof Gist> {}

const decodeGist = Schema.decodeUnknownEither(Gist);

const getAndParseGist = pipe(
  fetchGist(id), // Effect.Effect<Response, 'fetch'>
  Effect.flatMap(getJson), // Effect.Effect<unknown, 'fetch' | 'json'>
  Effect.flatMap(decodeGist), // Effect.Effect<Gist, 'fetch' | 'json' | DecodeError>
);

Effect.runPromise(getAndParseGist)
  .then(x => console.log("decoded gist %o", x))
  .catch(err => console.error(err));

// The second main type of code you can find in the wild is callback based
import * as fs from "node:fs";

/*
 * Here we wrap the readFile function provided by Node, using Effect.async.
 *
 * Effect.async provides us with a resume function that we can call passing a
 * succeeding effect or a failure in order to resume the suspended computation.
 *
 * It's similar to a Promise's resolve function, but with an explicit error value.
 */
export const readFileEffect = (path: fs.PathOrFileDescriptor) =>
  Effect.async<Buffer, NodeJS.ErrnoException>((resume, signal) =>
    fs.readFile(path, { signal }, (error, data) => {
      if (error) {
        resume(Effect.fail(error));
      } else {
        resume(Effect.succeed(data));
      }
    }),
  );
