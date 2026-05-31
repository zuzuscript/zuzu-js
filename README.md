# ZuzuScript JavaScript Runtime

`zuzu-js` is the JavaScript implementation of ZuzuScript. It provides a
Node command-line runtime, a browser bundle, an Electron launcher, and a
compiler that can emit standalone JavaScript from ZuzuScript source.

## Installation

```sh
npm install -g zuzu-js
```

The global npm bin directory must be in your `PATH`. After installation,
the package provides these commands:

- `zuzu`: dispatches to the first available ZuzuScript implementation in
  `PATH`, checking `zuzu-rust`, `zuzu.pl`, then `zuzu-js`.
- `zuzu-js`: runs ZuzuScript with the JavaScript runtime.
- `zuzu-js-compile`: compiles a ZuzuScript program into standalone
  JavaScript.
- `zuzu-js-electron`: runs GUI-oriented ZuzuScript programs through
  Electron.

Set `ZUZU` to force the dispatcher to use a specific implementation:

```sh
ZUZU=zuzu-js zuzu -e 'say("Hello from ZuzuScript");'
```

## Command Line

Run inline source:

```sh
zuzu-js -e 'say("Hello, world");'
```

Run a script:

```sh
zuzu-js path/to/script.zzs
```

Compile a script:

```sh
zuzu-js-compile path/to/script.zzs -o script.js
node script.js
```

Use `zuzu` when you want the first installed ZuzuScript implementation
available on your `PATH`:

```sh
zuzu -e 'from std/string import kebab; say kebab("hello world");'
```

## Browser Bundle

The package includes prebuilt browser assets:

- `dist/zuzu-browser.js`
- `dist/zuzu-browser-worker.js`

Load the browser bundle from an installed package, copied asset, or your
application bundler:

```html
<script src="dist/zuzu-browser.js"></script>
<script>
const runtime = ZuzuBrowser.createBrowserRuntime();
const result = runtime.zuzu_eval('say("Hello from the browser");');
console.log(result.stdout);
</script>
```

The package also contains internal browser bundle helper scripts under
`bin/`, but they are not installed as global npm commands.

## JavaScript API

```js
const { createNodeRuntime } = require('zuzu-js');

const runtime = createNodeRuntime();
runtime.runSource('say("Hello from JavaScript");').then((result) => {
	process.stdout.write(result.stdout);
});
```

The public API is still evolving. The command-line tools and bundled
runtime entry points are the most stable interfaces.

## Standard Library

The npm package includes JavaScript-backed runtime modules under
`modules/` and pure ZuzuScript standard-library modules under
`stdlib/modules/`. Pure ZuzuScript modules are loaded, parsed, and
evaluated through normal ZuzuScript runtime semantics.

## Status

This is an early npm release of the JavaScript runtime. It is useful for
running and compiling ZuzuScript programs, but language and standard
library compatibility are still under active development.

## Licence

`zuzu-js` is free software; you may redistribute it and/or modify it
under the terms of either the Artistic License 1.0 or the GNU General
Public License version 2 or later.

SPDX-License-Identifier: `Artistic-1.0 OR GPL-2.0-or-later`
