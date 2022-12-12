import * as Context from "@fp-ts/data/Context";

export interface Foo {
  readonly foo: number;
}

export const Foo = Context.Tag<Foo>();

export interface Bar {
  readonly bar: number;
}

export const Bar = Context.Tag<Bar>();

export interface Baz {
  readonly baz: number;
}

export const Baz = Context.Tag<Baz>();

export interface FileDescriptor {
  readonly fd: number;
}

export const FileDescriptor = Context.Tag<FileDescriptor>();
