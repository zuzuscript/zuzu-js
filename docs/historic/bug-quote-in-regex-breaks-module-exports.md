# Bug: a quote character inside a regex literal silently breaks module exports

## Summary

On zuzu-js, if a `.zzm` module contains a regex literal with a raw `"`
or `'` character in it — even backslash-escaped (`\"`, `\'`) — every
top-level declaration *after* that regex silently disappears from the
module's exports. Importing such a name succeeds but binds **null**, so
the failure surfaces far from the cause as
`TypeError: <name> is not a function` (or a null where a value was
expected) in the *importing* code.

The module itself is transpiled and evaluated correctly; only the
export table is wrong. zuzu-rust and zuzu.pl are unaffected.

**Status: FIXED** — commit 3ee5f08 ("Fix module exports after regex
literals", 2026-06-08) added regex-literal tracking to the export-name
scanner together with a regression test, and the fix is published in
zuzu-js 0.3.0 on npm. Installed packages older than that (e.g. 0.1.1)
still have the bug — update them. This document is kept for historical
reference.

## Reproduction

```zzs
// q.zzm
function one ( String esc ) {
	return esc ~ /x"y/;        // any of: /x"y/  /x\"y/  /["]/  /[\']/
}

function two () {
	return "hi";
}
```

```zzs
// main.zzs
from q import one, two;
say( one("z") );               // works — declared before the regex
say( two == null ? "NULL" : two() );   // NULL on affected builds
```

Real-world hit: `rdf/sparql/lexer.zzm` had
`esc ~ /^[btnrf"'\\]$/`, which nulled the later `sparql_lex` export and
broke every SPARQL query on zuzu-js with
`sparql_lex is not a function`.

## Cause

Module loading transpiles the module correctly, but builds the list of
exported names separately, with the text-scanning helper
`collectTopLevelDeclarations` in `lib/runtime-helpers.js`
(used from `loadModule` in `lib/runtime.js`). That helper masks out
strings and comments before grepping for top-level
`function`/`class`/`let`/`const` declarations.

In affected builds the masking scanner has **no notion of regex
literals**. When it meets the `"` inside `/x"y/` it thinks a
double-quoted string just opened, and stays in "inside string" state
until the next `"` in the file — masking out the following declarations.
Names that are masked never get an export-bridge accessor, so
`module.exports` lacks them, and the importing side's
`__zuzu_imported["two"] ?? null` getter yields null.

The real lexer (`lib/transpiler-new/lexer.js`) handles regex literals
correctly, which is why the same code works in a plain `.zzs` script and
why the module body itself runs fine — only the export-name scan was
wrong.

## Fix

Commit 3ee5f08 fixed this: `collectTopLevelDeclarations` now tracks
`inRegex` / `inRegexClass` state, entering regex mode via the
`looksLikeRegexLiteralStart` heuristic (previous non-space character is
an operator/opener such as `~ ( [ { = , : ;`), with a regression test in
`test/declaration-unpacking.js`. The fix ships in zuzu-js 0.3.0.

A remaining longer-term consideration: deriving export names from the
real lexer or the transpiled output instead of a parallel text scanner —
the `looksLikeRegexLiteralStart` heuristic can still disagree with the
actual lexer in corner cases (e.g. division), and any future divergence
will produce the same silent-null failure mode.

## Workaround (for code that must run on affected builds)

Avoid raw quote characters inside regex literals; use hex escapes,
which all three runtimes accept:

```zzs
unless esc ~ /^[btnrf\x22\x27\\]$/;   // instead of /^[btnrf"'\\]$/
```

Applied in `tobyink-dists/rdf` (`rdf/sparql/lexer.zzm`,
`rdf/sparql.zzm`, `rdf/sparql/results.zzm`), tagged with comments
mentioning the zuzu-js tokenizer.
