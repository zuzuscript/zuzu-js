# ZuzuScript JavaScript Runtime

This repository contains the JavaScript implementation of ZuzuScript,
including the Node CLI `zuzu-js`, browser runtime support, Electron GUI
support, and `zuzu-js-compile`.

Use Oxford English in documentation. Prefer standard British English with
`-ize` word endings.

## Split Repository Layout

Shared ZuzuScript resources live in submodules:

- `stdlib/modules` contains Pure Zuzu Modules and POD stubs for
  runtime-supported modules.
- `stdlib/tests` contains standard-library ztests.
- `stdlib/test-modules` contains test helper modules.
- `stdlib/test-fixtures` contains standard-library fixtures.
- `languagetests` contains language-level ztests.
- `docs/examples` and `docs/userguide` are documentation submodules.

The JavaScript runtime's native module implementations live in this
repository's `modules` directory. Do not refer to sibling repositories with
`..`; add shared resources as git submodules instead.

## Runtime Rules

If a Pure Zuzu Module exists, the JavaScript runtime must load, parse, and
evaluate it through normal ZuzuScript semantics. Do not add JavaScript-side
shortcuts or native replacements for Pure Zuzu Modules, especially
`std/path/*`, `std/path/z`, and `std/path/zz`.

Runtime-supported modules should be implemented in JavaScript where needed.
The runtime-supported `perl.zzm` module is out of scope for `zuzu-js`.

The browser runtime is not expected to support the full stdlib, but
`std/string`, `std/data/json`, `std/data/xml`, `std/net/http`, `std/math`,
and `std/eval` need to work. Pure modules such as `std/uuid`, `std/path/z`,
and `std/dump` are especially important.

## Tests

Use `nice` for heavier test commands:

    nice -n 10 npm test
    nice -n 10 node bin/zuzu-js -e 'say("OK");'
    nice -n 10 node bin/zuzu-js languagetests/basic.zzs

The key compatibility target is running ztests from `languagetests` and
`stdlib/tests` through `zuzu-js`. Ztests emit TAP; a passing ztest should
emit a valid plan, no `not ok` lines, and exit with status zero.

## Style

Follow the existing CommonJS style and spacing. For ZuzuScript code, use tabs
for indentation, spaces for alignment, One True Brace Style, uncuddled
`else`, whitespace around binary operators, and semicolons as terminators.
