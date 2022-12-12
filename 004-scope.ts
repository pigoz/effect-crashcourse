import { pipe } from "@fp-ts/data/Function";
import * as Z from "@effect/io/Effect";
import * as Scope from "@effect/io/Scope";
import * as Exit from "@effect/io/Exit";
import { logged } from "utils/debug";
import { FileDescriptor } from "utils/contexts";
import * as fs from "node:fs";
import { promisify } from "node:util";

/* In this chapter we explore Scope.
 *
 * It is useful to understand Layer in the following chapter and since Scope
 * can be used on it's own without Layer, I decided to it made sense to
 * introduce it before Layer.
 *
 * What is Scope? It's a datatype to model the lifetime of resources.
 *
 * In practice it is a collection of finalizers. It has 3 main methods:
 *
 *  - addFinalizer: adds a new finalizer to the Scope
 *      (a finalizer is an Effect! turtles, amiright?)
 *
 *  - close: closes the Scope executing all the finalizers that were added to it
 *
 *  - fork: creates a child Scope from the given Scope. When the parent Scope
 *    is closed, it's children are closed as well.
 */

/* We mentioned resources above. So the new question becomes: what is a resource?
 *
 * They are also known as "scoped effect" in the Effect docs, or "scoped value"
 * in the ZIO docs.
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
export const resource: Z.Effect<Scope.Scope, never, FileDescriptor> =
  Z.acquireRelease(
    pipe(
      Z.promise(() => promisify(fs.open)("/dev/null", "w")),
      Z.map((fd) => ({ fd })),
      logged("FileDescriptor acquired")
    ),
    ({ fd }) =>
      pipe(
        Z.promise(() => promisify(fs.close)(fd)),
        logged("FileDescriptor released")
      )
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
type useFileDescriptor = Z.Effect<never, never, void>;

export const useFileDescriptorStupid: useFileDescriptor = Z.gen(function* ($) {
  const scope = yield* $(Scope.make());
  const fd = yield* $(pipe(resource, Z.provideService(Scope.Tag)(scope)));
  console.log("useFileDescriptorStupid", fd);
  yield* $(Scope.close(Exit.unit())(scope));
});

/* If you look closely at it, the previous code can be split in 3 steps:
 *
 *  - acquire: creates the scope with Scope.make
 *  - use: provides the scope to the resource and console.log
 *  - release: closes the scope
 *
 *  Since this is a common pattern, Effect comes with a function called
 *  acquireUseRelease to build such effects.
 */
export const useFileDescriptorSmarter: useFileDescriptor = Z.acquireUseRelease(
  Scope.make(),
  (scope) =>
    pipe(
      resource,
      Z.provideService(Scope.Tag)(scope),
      logged("useFileDescriptorSmarter")
    ),
  (scope) => Scope.close(Exit.unit())(scope)
);

/* That was still quite long to write, and using scopes is very common.
 *
 * So Effect comes with a `scoped` function that does the whole the
 * acquireUseRelease dance for you, providing a Scope to it's argument, and
 * closing it once it's done running.
 */
export const useFileDescriptor: useFileDescriptor = pipe(
  resource,
  logged("useFileDescriptor"),
  Z.scoped
);

/* Z.unsafeRunPromise(useFileDescriptor); will print something like:
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
 * For our stupid example, the following would have been perfectly fine, and
 * it would be fine to handle access to resources that aren't application wide
 * and meant to be reused.
 */
export const writeSomethingToDevNull = (something: string) =>
  Z.acquireUseRelease(
    Z.promise(() => promisify(fs.open)("/dev/null", "w")),
    (fd) => Z.promise(() => promisify(fs.writeFile)(fd, something)),
    (fd) => Z.promise(() => promisify(fs.close)(fd))
  );
/*
 * But the point of Layers is to define application wide resources.
 *
 * The "use" effect is your whole application, thus inversion of control is
 * not possible and you have to use acquireRelease and Scope.
 */
