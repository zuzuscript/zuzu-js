# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project roughly adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
