import { pipe } from "@fp-ts/data/Function";
import * as Z from "@effect/io/Effect";

const fetchGist = (id: string) =>
  Z.tryCatchPromise(
    () => fetch(`https://api.github.com/gists/${id}`),
    () => "fetch error" as const
  );

const getJson = (res: Response) =>
  Z.tryCatchPromise(
    () => res.json(),
    () => "get json error" as const
  );

const program = pipe(
  fetchGist("97459c0045f373f4eaf126998d8f65dc"),
  Z.flatMap(getJson),
  Z.flatMap((gist) => Z.sync(() => console.log(gist)))
);

Z.unsafeRunPromiseExit(program);
