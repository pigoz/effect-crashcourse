import { Effect, pipe } from "effect";
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
 * The first argument is a callback that returns the Promise to wrap.
 *
 * The second is a callback that returns a value to put in the error channel
 * (E in Effect<R, E, A>) in case the Promise throws an exception.
 */
const fetchGist = (id: string) =>
  Effect.tryPromise({
    try: () => fetch(`https://api.github.com/gists/${id}`),
    catch: () => "fetch" as const,
  }); // Effect.Effect<never, "fetch", Response>

const getJson = (res: Response) =>
  Effect.tryPromise({
    try: () => res.json() as Promise<unknown>, // Promise<any> otherwise
    catch: () => "json" as const,
  }); // Effect.Effect<never, "json", unknown>

/*
 * Schema is a library in the Effect ecosystem that allows you to parse and
 * encode data in a type-safe way.
 *
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
export interface Gist extends Schema.To<typeof GistSchema> {}

const getAndParseGist = pipe(
  // Effect.Effect<never, 'fetch', Response>
  fetchGist(id),

  // Effect.Effect<never, 'fetch' | 'json', unknown>
  Effect.flatMap(getJson),

  // Effect.Effect<never, 'fetch' | 'json' | DecodeError, Gist>
  Effect.flatMap(parseEither(GistSchema)),
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
  Effect.async<never, NodeJS.ErrnoException, Buffer>(resume =>
    fs.readFile(path, (error, data) => {
      if (error) {
        resume(Effect.fail(error));
      } else {
        resume(Effect.succeed(data));
      }
    }),
  );

/*
 * asyncInterrupt works similarly, but also allows to handle interruptions
 * (we will explore what interruptions are in future chapters)
 *
 * If the Effect returned from readFileEffectInterrupt gets interrupted by
 * the runtime controller.abort() will be called, resulting in the underlying
 * fs.readFile being interrupted too.
 */
export const readFileEffectInterrupt = (path: fs.PathOrFileDescriptor) =>
  // NOTE: this one of the few occasions where Effect needs us to pass in the
  // correct generics, otherwise types don't get inferred properly.
  Effect.asyncInterrupt<never, NodeJS.ErrnoException, Buffer>(resume => {
    const controller = new AbortController();

    fs.readFile(path, { signal: controller.signal }, (error, data) => {
      if (error) {
        resume(Effect.fail(error));
      } else {
        resume(Effect.succeed(data));
      }
    });

    return Effect.sync(() => controller.abort());
  });
