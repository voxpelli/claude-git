# Changelog

## 0.5.0 (2026-04-28)

### Changes

- **Pilot: replace in-tree Layer 5 with `skill-check`** (treat as
  experimental for this repo; do not promote as a recommended pattern
  until we have lived with it for a release cycle or two). The custom
  `check-skill-spec.mjs` and its fixture corpus shipped in 0.4.0
  duplicated `thedaviddias/skill-check`'s 22-rule validator with five
  in-house rules. Drop the custom validator; invoke
  `skill-check check --no-security-scan` as `npm run check:spec`.
  Net: ~80% code deletion vs 0.4.0. Trade-off accepted with eyes
  open — skill-check is a transitive supply-chain dependency
  (single-maintainer npm package, MIT, 68 stars at adoption time).
  The protection over 0.3.0 is real for cross-agent spec drift, but
  the marginal value for a one-skill repo is modest.
- **Keep one vp-git-specific check**: `check-portability.mjs`
  (~50 lines) — flags `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}`
  references and `../` path escapes that break under skills.sh
  symlinked install. skill-check has no equivalent. Warn-only.
  Honors a future `claude-only: true` frontmatter opt-out. This
  check is the part of 0.5.0 that earns its place unambiguously.
- **`skill-check.config.json`** — suppresses
  `frontmatter.allowed_tools_format` (Claude Code uses array form)
  and `frontmatter.unknown_fields` (Claude Code defines extra fields
  like `user-invocable`). Other rules run with defaults.
- **rebase-validate** — description updated from "This skill should
  be used after..." to "...Use when verifying a git rebase..." to
  satisfy `description.use_when_phrase` and improve trigger matching.
- Removed `npm run release` and `npm run advisory` scripts — with the
  custom validator gone there is no separate full-mode pass, and the
  spec gate is now `check:spec`.

## 0.4.0 (2026-04-28)

### Features

- **Layer 5 SKILL.md spec compliance** -- New `check-skill-spec.mjs`
  validator enforces agentskills.io spec rules in addition to the
  existing structural validation. Lite mode (always on) covers length
  caps, name regex with parent-directory match, XML-bracket guards in
  frontmatter, and warn-only body portability checks for
  `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}` / `../` references.
  Full mode (`npm run release`) adds a description-quality heuristic.
- **Adversarial fixture corpus** -- `test/fixtures/` with 8 violation
  scenarios + a baseline; runner wired into `npm run check` via
  `check:fixtures` so rule regressions surface immediately.
- **`npm run release`** -- Strict release gate: full check pipeline +
  full Layer 5 advisory rules. Failures block tagging.
- **`npm run advisory`** -- Non-blocking invocation of
  `@thedaviddias/skill-check` for upstream advisory feedback. Exit
  code is informational; never release-blocking.
- `plugin-utils.mjs` -- New shared module hoists `ROOT`,
  `formatError`, `formatWarn`, and `extractFrontmatter` (with CRLF
  normalization) from `validate-plugin.mjs` so the new validator
  can reuse them without drift.

## 0.3.0 (2026-04-28)

### Features

- **Cross-agent install** -- The skill is now installable via the open
  Agent Skills standard from any compatible agent (Claude Code, Cursor,
  Codex CLI, Gemini CLI, GitHub Copilot, Kiro, ...). Run
  `npx skills add voxpelli/claude-git` to install without the plugin.
- **rebase-validate** -- Added `license: MIT` and `compatibility:`
  frontmatter for spec compliance with [agentskills.io](https://agentskills.io).
- **rebase-validate** -- Softened two body sentences ("parallel agents")
  with a sequential-fallback note for agents without a parallel-Agent tool.
- `validate-plugin.mjs` -- Added type checks for optional `license` and
  `compatibility` skill frontmatter fields.

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
