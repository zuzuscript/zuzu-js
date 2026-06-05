# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project roughly adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Changed

- Bumped the package and CLI version to 0.1.1.
- Updated the `docs/userguide` and `languagetests` submodules.
- Removed the accidental `zuzu-js` self-dependency from the package metadata.

### Added

- Added synchronous `std/io` path append helpers for UTF-8 text and
  binary data.

### Fixed

- Fixed string indexing and slicing to use character offsets, including
  negative indexes and Unicode text.
- Added BinaryString index and slice assignment support.
- Updated CLI and browser GUI regression coverage for current runtime
  behaviour.
- Fixed `std/proc` synchronous command stdin handling.
- Fixed aliased `std/eval` imports so eval calls can capture and mutate the
  current scope.
- Fixed catch parameter scope capture during transpilation.
- Fixed `Exception` type checks to match JavaScript errors.
- Fixed `!=` and `≠` to use general inequality semantics instead of numeric
  inequality only.

## [0.1.0] - 2026-05-31

*First release.*
