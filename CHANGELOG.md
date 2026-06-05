# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project roughly adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Updated the `docs/userguide` and `languagetests` submodules.

### Fixed

- Fixed string indexing and slicing to use character offsets, including
  negative indexes and Unicode text.
- Added BinaryString index and slice assignment support.
