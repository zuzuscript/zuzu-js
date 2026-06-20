# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project roughly adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Switch case and default bodies now have access to the active switch value
  via `^^`, including through fallthrough and async execution paths.

### Fixed

- `switch` no longer executes the `default` block after a matched case unless
  fall-through was requested with `continue`.

## 0.6.0 - 2026-06-19

### Fixed

- The `?:` operator now preserves any defined left-hand value and falls back
  only when the left-hand value is null, instead of using truthiness.
- `Path.tempfile()` and `Path.tempdir()` now attach lifecycle cleanup to the
  returned `Path` object, deleting temporary files and recursively deleting
  temporary directories when `__demolish__` would run.
- Returned collections now correctly keep destructible values alive until the
  collection itself is released, fixing premature cleanup of `Path.tempdir()`
  roots used by Zuzuzoo install and source metadata operations.

## 0.5.0 - 2026-06-17

### Added

- `switch` case values can now override the switch comparator with a
  comparison operator prefix, such as `case ~ /^Rob/` or `case eqi "Bob"`.
- Added `ZuzuBrowser.addModule(moduleName, url)` for browser runtimes so
  whitelisted remote ZuzuScript modules can be fetched, parsed, imported, and
  cached on first use; the browser distribution ZIP README now documents this
  API.
- Added logical operators `nor`/`⊽`, `xnor`/`↔`, `onlyif`/`⊨`,
  `butnot`/`⊭`, plus the value-preserving `and?`/`⋀?`, `or?`/`⋁?`,
  `xor?`/`⊻?`, `xnor?`/`↔?`, `nand?`/`⊼?`, `nor?`/`⊽?`,
  `onlyif?`/`⊨?`, and `butnot?`/`⊭?` variants.
- `std/path/zz` ZZPath expressions now recognise and evaluate the new
  language operators for bit shifts, divisibility, logical combinations, and
  value-preserving logical combinations.

### Fixed

- Boolean operators `not`, `!`, `¬`, `and`, `⋀`, `or`, `⋁`, `xor`, `⊻`,
  `nand`, and `⊼` now return Boolean values instead of numeric `0`/`1`
  values.
- Logical operator precedence now matches the language definition: `and`/`nand`
  bind tighter than `xor`, which binds tighter than `or`. The `⊤` and `⊥`
  Boolean literals are also now accepted by the JS lexer.
- Collection parity fixes: `Array.join()` now supports an unstringable-value
  substitute or callback, `Bag.remove()` removes every matching value, and
  unordered Bags no longer expose `get()`. Zuzu Array calls now consistently
  use Zuzu collection semantics instead of native JS method arities, Set
  `clear()` returns the Set, Dict `keys()`/`values()`/`enumerate()` return
  Set/Bag/Bag, PairList exposes `is_empty()`, and Set exposes
  `push_weak()` as an alias for `add_weak()`. `Array.get()` now requires an
  index, `get()`/`set()`/`set_weak()` count negative indexes from the end,
  Array callback methods reject missing or extra callback arguments, and
  `sample()`/`shuffle()` return randomised non-mutating results.
- Dynamic method calls whose method expression evaluates to a Method value now
  invoke that method with the syntactic receiver, matching zuzu-perl and
  zuzu-rust, and computed method-call receivers are evaluated once.
- Bare wordlike named-argument keys such as `length: 42` now parse like
  the same unquoted keys in Dict and PairList literals.

## 0.4.0 - 2026-06-12

*stdlib tag 20260612, languagetests tag 20260612.*

### Added

- std/net/url's `fill_template` is now a complete RFC 6570 URI
  Template implementation (all operators, `:N` prefix and `*` explode
  modifiers, list and associative values), implemented with the
  @std-uritemplate/std-uritemplate package and validated against the
  official URI Template test suite. Invalid templates throw; Dict keys
  expand in sorted order.
- New divisibility operators: `a ∣ b` (U+2223; ASCII alias `divides`,
  a new keyword) is a Boolean test that the left operand exactly
  divides the right; `a ∤ b` (U+2224, no ASCII alias) returns the
  Number `b mod a`, truthy exactly when the left operand does not
  divide the right. Both coerce operands to Number and sit at the
  comparison precedence tier.
- `for` loops (including postfix `for`) iterate over the characters of a
  String (each a 1-character String) and the bytes of a BinaryString
  (each a 1-byte BinaryString).
- Bitshift operators `<<`, `>>`, `«`, `»`. Numbers shift arithmetically
  (operands truncated to integers; negative shift counts throw).
  BinaryStrings shift as one whole bit string: bits carry across byte
  boundaries, length is preserved, vacated bits are zero. Shifts bind
  tighter than bitwise `&`/`|`/`^` and looser than additive operators;
  inside a set literal the closing `>>`/`»` still terminates the
  literal.
- Numeric literals: uppercase-E exponents (`1E3`, `2.5E-7`), hex
  (`0x1F`), binary (`0b1111`), and octal (`0o100`) with lowercase
  prefixes. Lowercase `1e3` and uppercase `0X`/`0B`/`0O` prefixes remain
  invalid in source, but String-to-Number coercion accepts either case
  for the exponent marker and radix prefixes.
- New `std/string/encode` module: `encode(String, encoding)` /
  `decode(BinaryString, encoding)` with UTF-8, UTF-16, UTF-32, and
  ISO-8859-1 codecs plus `ENCODING_UTF8`/`ENCODING_UTF16`/
  `ENCODING_UTF32`/`ENCODING_LATIN` constants. Encoding names match
  case-insensitively; UTF-16/UTF-32 encode big-endian without a BOM and
  decode honours a leading BOM.
- `std/string` exports `to_binary` and `to_string`.

### Fixed

- `std/math/bignum` now returns String values from `BigNum.to_dec` and
  `BigNum.to_String` consistently; use `BigNum.to_Number` for numeric
  conversion.
- Fixed `std/math` so `Math.pi` is exposed as a callable zero-argument method
  while module-level `pi`/`π` imports remain scalar constants.
- String comparison operators (`cmp`, `lt`, `gt`, `le`, `ge` and their
  case-insensitive variants) and `sortstr` now order strings by Unicode
  code point, matching zuzu-rust and zuzu-perl. Previously they used
  `localeCompare`, giving locale-dependent, case-folded ordering (e.g.
  `"filterUnits" cmp "filterres"` returned 1 instead of -1).
- Added missing `std/time` instance methods to restore parity with
  `zuzu-perl` and `zuzu-rust` (`yy`, `day_of_week`, `day_of_year`,
  `month_last_day`, `hms`, `ymd`, `mdy`, `dmy`, `date`, `time`,
  `cdate`, `tzoffset`, `is_leap_year`, `week`, `week_year`,
  `julian_day`).
- Added cross-host conformance coverage for the `Time` method surface in
  `test/cross-host-conformance.js`.
- Fixed `std/math/bignum` in the JS runtime to expose BigNum operations as
  callable instance methods, and made integer `bpow` use BigInt arithmetic so
  large exponents (such as `BigNum.from_dec("10").bpow(1000)`) produce exact
  decimal text.
- Fixed `std/time` wall-time derived methods so `day_of_week`, `day`, and
  `day_of_year` use local calendar parts consistently with Perl and Rust time
  behavior.
- Aligned `say` output for IEEE infinities with Perl runtime behaviour so
  overflowing numeric results render as `Inf` and `-Inf` rather than
  `Infinity` and `-Infinity`.

## 0.3.0 - 2026-06-10

*stdlib tag 20260610, languagetests tag 20260610.*

### Changed

- Bumped the package and CLI version to 0.3.0.

### Fixed

- Rejected direct assignment, compound assignment, and increment/decrement
  updates targeting method or function calls in the new transpiler, while
  still allowing assignment into collections returned from calls.
- Removed the zero-argument dot-call fallback to object fields so
  `object.name` and `Class.name` always behave as method calls.
- Fixed mixed positional/named argument handling for constructor calls and
  runtime functions using `... PairList` plus trailing positional parameters.

## 0.2.0 - 2026-06-08

*stdlib tag 20260608, languagetests tag 20260608.*

### Changed

- Bumped the package and CLI version to 0.2.0.
- Updated statement parsing so simple statements require semicolons unless
  they are final in a block or file.

### Fixed

- Fixed function, lambda, and method parameter bindings so assignment attempts
  fail as immutable binding mutations.
- Fixed module export detection after regexp literals.

## 0.1.2 - 2026-06-05

### Changed

- Bumped the package and CLI version to 0.1.2.

### Added

- Added synchronous `std/io` path append helpers for UTF-8 text and
  binary data.

### Fixed

- Fixed `std/proc` synchronous command stdin handling.
- Fixed aliased `std/eval` imports so eval calls can capture and mutate the
  current scope.
- Fixed catch parameter scope capture during transpilation.
- Fixed `Exception` type checks to match JavaScript errors.
- Fixed `!=` and `≠` to use general inequality semantics instead of numeric
  inequality only.

## 0.1.1 - 2026-06-05

### Changed

- Bumped the package and CLI version to 0.1.1.
- Updated the `docs/userguide` and `languagetests` submodules.
- Removed the accidental `zuzu-js` self-dependency from the package metadata.

### Fixed

- Fixed string indexing and slicing to use character offsets, including
  negative indexes and Unicode text.
- Added BinaryString index and slice assignment support.
- Updated CLI and browser GUI regression coverage for current runtime
  behaviour.

## 0.1.0 - 2026-05-31

*First release.*
