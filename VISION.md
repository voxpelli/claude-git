# Vision: vp-git Plugin

## Origin

Born from a 111-commit, 7-branch stacked rebase (April 2026) where standard
tooling (lint, tests, sem, weave) missed 3 duplicate test blocks, a broken
backup ref, and several stale references. The five-layer validation pipeline
was developed iteratively during that session, validated against 15+ research
agents, and documented as a reusable methodology.

## Current State (v0.1.0)

One skill: `rebase-validate`. Covers the post-rebase verification workflow
with five layers: range-diff, sem, weave, jscpd, and functional tests.

## Future Skills

### merge-validate

Validate a merge result for correctness. Similar pipeline to rebase-validate
but focused on merge conflicts rather than rebased commits. Would use
`weave summary --json` for structured conflict analysis and `sem impact` for
blast-radius assessment of conflict resolutions.

### stacked-pr-prep

Prepare a branch for splitting into stacked PRs. Analyze commit history,
suggest split points based on file/entity scope, create the branch structure,
and verify each PR's scope with sem diff. Would codify the commit-mapping and
drop-list methodology used in the key-lookup rebase.

### branch-cleanup

Audit local and remote branches for staleness. Identify branches that have
been merged, superseded, or abandoned. Cross-reference with worktrees and
rerere cache. Suggest cleanup actions with safety checks.

### conflict-triage

When a merge or rebase produces conflicts, triage them by severity and suggest
resolution strategies. Use weave's ConGra taxonomy (Text/Syntax/Functional)
and sem's entity graph to prioritize which conflicts to resolve first and
identify which resolutions have the largest blast radius.

### reflog-explorer

Interactive exploration of git reflog to recover lost work, understand branch
history, and audit what happened during a rebase. Extract "before" snapshots
from reflog entries for comparison with current state.

## Future Agents

### rebase-verifier

Autonomous agent that runs the full rebase-validate pipeline without user
instruction. Could be triggered by a PostToolUse hook on `git rebase
--continue` or by detecting that the current branch was just rebased (reflog
check).

### merge-auditor

Autonomous agent that runs merge-validate after every `git merge`. Checks
for entity-level regressions, duplicate code, and stale references.

## Future Hooks

### PostToolUse: Auto-validate after rebase

When Claude runs `git rebase --continue` (the final one that completes the
rebase), automatically trigger the rebase-validate pipeline. This shifts
validation from "user remembers to ask" to "always happens."

### PreToolUse: Warn before unsafe rebase patterns

Before `git rebase` with `--update-refs`, warn about the silent ref movement
behavior and suggest creating tags first. Before `git push --force`, verify
the rebase was validated.

## Integration Points

### With vp-knowledge

- `session-reflect` can capture rebase validation findings as Basic Memory
  observations
- `tool-intel` documents sem/weave capabilities referenced by rebase-validate
- `package-intel` documents jscpd and eslint-plugin-node-core-test

### With vp-beads

- Sprint retrospectives can reference rebase validation results
- `upstream-tracker` can log sem/weave limitations as upstream friction

### With sem/weave ecosystem

- As sem adds test-file entity extraction (describe/it blocks), the validation
  pipeline's Layer 2 coverage will automatically improve
- As weave exposes `WEAVE_MAX_DUPLICATES` tuning, Layer 3 can cover more
  test files

## Design Constraints to Respect

These emerge from tool limitations and should guide future skill design:

| Constraint | Source | Impact |
|-----------|--------|--------|
| 32KB file size limit | tree-sitter buffer | Files above this are invisible to sem/weave |
| 1000-line default | jscpd `--max-lines` | Files above this are silently skipped |
| 10 same-name entities | weave `WEAVE_MAX_DUPLICATES` | Triggers line-level fallback |
| node:test silent duplicates | node:test runtime | No warning for duplicate test names |
| --update-refs moves all refs | git rebase | Backup branches can be silently moved |
| rerere silent replay | git rerere | Past resolutions applied without review |

## Guiding Principles

1. **Validate the validator** -- every tool has blind spots. The pipeline's
   value is in catching what each individual tool misses.
2. **Baselines before changes** -- without a baseline, you can't distinguish
   pre-existing issues from newly introduced ones.
3. **Verify refs before comparing** -- a wrong ref makes the entire comparison
   meaningless. This was learned the hard way.
4. **Silent failures are the enemy** -- three tools (sem, jscpd, weave) have
   thresholds that silently exclude files. Document and work around them.
5. **Delegate early, decide late** -- launch verification agents immediately
   after a rebase. Don't make decisions until results arrive.
