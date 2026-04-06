# Changelog

## 0.2.0 (2026-04-06)

### Improvements

- **rebase-validate** -- Improved skill description for better discoverability
  (third-person phrasing convention).
- **rebase-validate** -- Added `--left-only`/`--right-only` flags and algorithm
  details to Layer 1 (range-diff). Documented that range-diff ignores merge
  commits by default.
- **rebase-validate** -- Added optional Layer 4c: ast-grep for structural
  pattern matching as a complement to jscpd.
- Renamed `references/tool-thresholds.md` to `references/silent-behaviors.md`
  to better reflect coverage of git rerere and --update-refs behaviors.

## 0.1.0 (2026-04-06)

### Features

- **rebase-validate** -- Five-layer pipeline for verifying rebase correctness:
  ref verification, range-diff, sem diff, weave preview, duplicate detection,
  and functional tests. Developed from a real 111-commit, 7-branch stacked
  rebase.
