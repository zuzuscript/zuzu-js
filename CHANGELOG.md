# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project roughly adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [0.1.0] - 2026-05-31

*First release.*
