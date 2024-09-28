### The practical guide I wish existed while learning [Effect](https://github.com/Effect-TS/)

This guide explores some concepts from [Effect](https://github.com/Effect-TS/effect).
It's designed to give you a feel for the library as fast as possible.

It's written from my point of view of a casual fp-ts user (i.e.: I use Option
and Either but I feel stupid as soon ad Applicative, Functor, Monad, etc are
mentioned).

#### Effect has a website now

This guide was written before Effect has a website or any documentation by 
poking at the Effect source code, ZIO docs

Now the [website](https://effect.website/) has a very comprehensive documentation. 
I'm leaving this here to benefit people with shorter attention spans.

### Usage

Start reading from [001-basic.ts](001-basic.ts)!

### Local environment

1. Install the packages in package.json with the package manager of your choice.
   (e.g. `npm install`)
2. Any file in this project can be run with the `run-file` script in
   package.json (e.g. `npm run run-file 001-basic.ts` or
   `npm run-file 001-basic.ts`). You may also use `tsx` directly
   (`npx tsx 001-basic.ts`).

### Web-based environment

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/pigoz/effect-crashcourse?file=001-basic.ts)

### Questions?

Feel free to open an issue with ideas for improvement, questions, or
contributions.

#### Contributors

Feel free to open a PR to improve the content.
