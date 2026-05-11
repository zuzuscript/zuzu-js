# ZuzuScript JavaScript Runtime

This repository contains the JavaScript implementation of ZuzuScript. It
provides the Node CLI `zuzu-js`, the browser runtime bundle, Electron GUI
support, browser ztest support, and `zuzu-js-compile`.

Use Oxford English in documentation: mostly standard British English, with
`-ize` word endings.

## Relationship To Other Projects

`zuzu-js` is one of the three main runtimes, alongside `zuzu-perl` and
`zuzu-rust`. It consumes shared resources through submodules:

- `stdlib` for shared modules, stdlib tests, fixtures, and test helpers.
- `languagetests` for language conformance tests.
- `docs/examples` and `docs/userguide` for examples and language reference.

The Android app and website consume the generated browser bundle from this
runtime. The matrix project runs this implementation in Node, Electron, and
browser modes.

Do not refer to sibling repositories with `..`; use the local submodules.

## Project Shape

- `lib/cli.js` implements the command-line entry point.
- `lib/runtime.js`, `lib/zuzu.js`, and `lib/runtime-entrypoints.js` hold the
  main runtime surface.
- `lib/host/` separates Node, browser, and Electron host capabilities.
- `lib/browser-*.js` and `bin/build-browser-bundle` produce browser assets.
- `lib/electron/` and `bin/zuzu-js-electron` support Electron execution.
- `lib/transpiler*` and `bin/zuzu-js-compile` support compilation to JS.
- `modules/` contains JavaScript implementations of runtime-supported
  modules.
- `test/` contains JavaScript implementation tests.

## Runtime Rules

If a Pure Zuzu Module exists, the runtime must load, parse, and evaluate it
through normal ZuzuScript semantics. Do not add JavaScript-side shortcuts or
native replacements for Pure Zuzu Modules, especially `std/path/*`,
`std/path/z`, and `std/path/zz`.

Runtime-supported modules should be implemented in JavaScript where needed.
The runtime-supported `perl.zzm` module is out of scope for `zuzu-js`.

The browser runtime is not expected to support the full stdlib, but
`std/string`, `std/data/json`, `std/data/xml`, `std/net/http`, `std/math`,
and `std/eval` need to work. Pure modules such as `std/uuid`, `std/path/z`,
and `std/dump` are especially important.

## Tests

Use `nice` for heavier commands:

```bash
nice -n 10 npm test
nice -n 10 node bin/zuzu-js -e 'say("OK");'
nice -n 10 node bin/zuzu-js languagetests/basic.zzs
nice -n 10 node run-ztests.js --include-std
```

The key compatibility target is running ztests from `languagetests` and
`stdlib/tests` through normal runtime semantics. Ztests emit TAP; a passing
ztest should emit a valid plan, no `not ok` lines, and exit with status
zero.

If browser or Electron behaviour changes, run the focused browser/Electron
tests as well as the Node path. Rebuild `dist/zuzu-browser.js` only when the
browser bundle is intentionally changing.

## Style

Follow the existing CommonJS style and spacing. For ZuzuScript code, use
tabs for indentation, spaces for alignment, One True Brace Style, uncuddled
`else`, whitespace around binary operators, and semicolons as terminators.
