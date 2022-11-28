// RUN with DEBUG=* npx ts-node src/http.ts
import { pipe } from "@fp-ts/data/Function";
import * as E from "@fp-ts/data/Either";
import * as Effect from "@effect/io/Effect";
// import * as Layer from '@effect/io/Layer';
// import * as Context from '@fp-ts/data/Context';
import { z } from "zod";
import debug_ from "debug";
import { decode } from "./utils/decode";

export const debug =
  (namespace: string) =>
  (formatter: any, ...args: any[]) =>
    Effect.sync(() => {
      debug_(namespace)(formatter, ...args);
    });

export const httpDebug = debug("http");

export const GetJson = (url: string, schema: z.Schema) =>
  pipe(
    Effect.tryCatchPromise(
      () => fetch(url),
      (err) => E.left({ message: "fetch failed", err })
    ),
    Effect.flatMap((res) =>
      Effect.tryCatchPromise(
        () => res.json(),
        (err) => E.left({ message: "json parse failed", err })
      )
    ),
    Effect.map(decode(schema)),
    Effect.flatMap(Effect.fromEither),
    Effect.flatMap((r) => httpDebug("%O", r))
  );

export const GetJsonGen = (url: string, schema: z.Schema) =>
  Effect.gen(function* ($) {
    const res = yield* $(
      Effect.tryCatchPromise(
        () => fetch(url),
        (err) => E.left({ message: "fetch failed", err })
      )
    );

    const json = yield* $(
      Effect.tryCatchPromise(
        () => res.json(),
        (err) => E.left({ message: "json parse failed", err })
      )
    );

    const result = yield* $(pipe(json, decode(schema), Effect.fromEither));

    // yield* $(httpDebug('%O', result));

    // dal momento che siamo dentro un generatore possiamo anche chiamare il
    // codice sincrono... un bene o un male:?
    debug_("http")("%O", result);
  });

const GistsSchema = z.array(
  z.object({ id: z.string(), description: z.string().nullable() })
);

const program = GetJsonGen("https://api.github.com/gists", GistsSchema);

Effect.unsafeFork(program);
