import { pipe, Effect, Scope, Exit } from "effect";
import { FileDescriptor } from "utils/contexts";
import * as fs from "node:fs";
import { promisify } from "node:util";

/* In this chapter we explore Scope.
 *
 * It is useful to understand Layer in the following chapter, but since Scope
 * can be used on it's own without Layer, it's being introduced here first.
 *
 * What is Scope? It's a datatype to model the lifetime of resources.
 *
 * In practice it is a collection of finalizers. It has 3 main methods:
 *
 *  - addFinalizer: adds a new finalizer to the Scope
 *
 *    A finalizer is an effect to be run when the Scope is closed, somewhat
 *    like a destructor in OOP
 *
 *  - close: closes the Scope executing all the finalizers that were added to it
 *
 *  - fork: creates a child Scope from the given Scope. When the parent Scope
 *    is closed, it's children are closed as well.
 */

/* We mentioned resources above. What is a resource?
 *
 * They are also known as "scoped effect". They are effects that require a Scope to run.
 *
 * In types they look like this:
 *
 *  Effect.Effect<Scope.Scope, DatabaseConnectionError, DatabaseConnection>
 *
 *
 * The most common way to create a "scoped effect" is the `acquireRelease`
 * function.
 *
 * As you can see from the return types acquireRelease returns us an effect
 * that needs a Scope to run (thus "Scoped effect").
 *
 * The Scope will be used to manage the lifetime of the resource.
 *
 * Under the hood the "Scoped effect" returned from `acquireRelease` does the
 * following:
 *
 * 1) Puts itself into an uninterruptible region, ensuring that both the
 *    acquire and release effects are executed without interruptions
 *
 * 2) Gets a Scope from the environment (that's why Scope is in the R generic),
 *    and creates a child with fork
 *
 * 3) Executes the acquire effect. If it is successful, the release effect is
 *    added to the forked scope with addFinalizer
 *
 * 4) Returns the A value from the acquire effect.
 *
 * Let's define a basic resource that implements the FileDescriptor interface.
 */
export const resource: Effect.Effect<Scope.Scope, never, FileDescriptor> =
  Effect.acquireRelease(
    pipe(
      Effect.promise(() => promisify(fs.open)("/dev/null", "w")),
      Effect.map(fd => ({ fd })),
      Effect.tap(() => Effect.log("FileDescriptor acquired")),
    ),
    ({ fd }) =>
      pipe(
        Effect.promise(() => promisify(fs.close)(fd)),
        Effect.tap(() => Effect.log("FileDescriptor released")),
      ),
  );

/*
 * The example above manages the lifetime of a File Descriptor.
 *
 * As you can imagine this could be any resource: a database connection pool,
 * a network connection, etc.
 *
 * Anyhow, we now have our "scoped effect". If we want to run it we have to
 * provide a Scope to it - which turns R from Scope to never.
 */
type useFileDescriptor = Effect.Effect<never, never, void>;

export const useFileDescriptorNaive: useFileDescriptor = Effect.gen(
  function* ($) {
    const scope = yield* $(Scope.make());
    const fd = yield* $(Effect.provideService(resource, Scope.Scope, scope));
    yield* $(Effect.log(`useFileDescriptorNaive ${fd}`));
    yield* $(Scope.close(scope, Exit.unit));
  },
);

/* If you look closely at it, the previous code can be split in 3 steps:
 *
 *  - acquire: creates the scope with Scope.make
 *  - use: provides the scope to the resource and Effect.logInfo
 *  - release: closes the scope
 *
 *  Since this is a common pattern, Effect comes with a function called
 *  acquireUseRelease to build such effects.
 */
export const useFileDescriptorSmarter: useFileDescriptor =
  Effect.acquireUseRelease(
    Scope.make(),
    scope =>
      pipe(
        resource,
        Effect.tap(_ => Effect.log(`useFileDescriptorSmarter ${_.fd}`)),
        Effect.provideService(Scope.Scope, scope),
      ),
    scope => Scope.close(scope, Exit.unit),
  );

/* While the first example didn't have any error handling, this has the added
 * benefit of being a spiritual equivalent to try-catch.
 *
 * If the acquire effect succeeds, the release effect is guaranteed to be run
 * regardless of the use effect's result (similar to a finally clause).
 *
 * That was still quite long to write, and using scopes is very common.
 *
 * So Effect comes with a `scoped` function that does the whole
 * acquireUseRelease dance for you, providing a Scope to it's argument, and
 * closing it once it's done running.
 */
export const useFileDescriptor: useFileDescriptor = pipe(
  resource,
  Effect.tap(_ => Effect.log(`useFileDescriptor ${_.fd}`)),
  Effect.scoped,
);

Effect.runPromise(useFileDescriptor);

/* Effect.runPromise(useFileDescriptor); will print something like:
 *
 * FileDescriptor acquired { fd: 22 }
 * useFileDescriptor { fd: 22 }
 * FileDescriptor released
 */

/* Bonus side note.
 *
 * acquireUseRelease is kind of a specialized version of acquireRelease.
 *
 * The main difference is acquireUseRelease knows when you are done using the
 * resource created with acquire (because you provide a use effect!), so it
 * also knows when it can execute release.
 *
 * On the other hand, with acquireRelease your whole code is the use effect,
 * so you have to go through closing a Scope to signal when your "use" has
 * completed.
 *
 * As an exercise, we can write acquireUseRelease in terms of acquireRelease.
 * The types are little more lax compared to the one provided by Effect, but
 * this is just to drive the point home.
 */
export const myAcquireUseRelease = <R, E, A, R2, E2, A2, R3, X>(
  acquire: Effect.Effect<R, E, A>,
  use: (a: A) => Effect.Effect<R2, E2, A2>,
  release: (
    a: A,
    exit: Exit.Exit<unknown, unknown>,
  ) => Effect.Effect<R3, never, X>,
) =>
  pipe(
    Effect.acquireRelease(acquire, release),
    Effect.flatMap(use),
    Effect.scoped,
  );

/*
 *
 * For our naive example, the following would have been perfectly fine, and
 * it would be fine to handle access to resources that aren't application wide
 * and meant to be reused.
 */
export const writeSomethingToDevNull = (something: string) =>
  Effect.acquireUseRelease(
    Effect.promise(() => promisify(fs.open)("/dev/null", "w")),
    fd => Effect.promise(() => promisify(fs.writeFile)(fd, something)),
    fd => Effect.promise(() => promisify(fs.close)(fd)),
  );

/*
 * We will see in the next chapter how to use Layer and Runtime to define
 * application wide resources.
 *
 * In that case the "use" effect is your whole application, thus inversion of
 * control is not possible and you have to use acquireRelease and Scope.
 */
