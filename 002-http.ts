import { pipe } from "@fp-ts/data/Function";
import * as Z from "@effect/io/Effect";

/*
 * The most iconic asynchronous example in JavaScript is fetching from APIs.
 * In this example we build a small program to fetch a Gist.
 */
const fetchGist = (id: string) =>
  Z.tryCatchPromise(
    () => fetch(`https://api.github.com/gists/${id}`),
    () => "fetch err" as const
  );

const getJson = (res: Response) =>
  Z.tryCatchPromise(
    () => res.json() as Promise<unknown>, // Promise<any> otherwise
    () => "get json err" as const
  );

const print = (message: string) =>
  Z.flatMap((obj) =>
    Z.sync(() => {
      console.log(message, obj);
      return obj;
    })
  );

const id = "97459c0045f373f4eaf126998d8f65dc";

const program = pipe(
  fetchGist(id), // Z.Effect<never, 'fetch error', Response>
  Z.flatMap(getJson), // Z.Effect<never, 'fetch err' | 'get json err', unknown>
  print("gist") // Z.Effect<never, 'fetch err' | 'get json err', void>
);

Z.unsafeRunPromiseExit(program);
