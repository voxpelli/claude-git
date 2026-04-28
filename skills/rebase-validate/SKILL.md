---
name: rebase-validate
description: "Validates git rebase correctness using a five-layer pipeline (range-diff, sem, weave, jscpd, tests). Use when verifying a git rebase (especially stacked PRs with --update-refs), comparing branches post-rebase, or auditing conflict resolution correctness. Covers scenarios like: 'validate rebase', 'check rebase', 'did we lose anything', 'compare before and after rebase', 'duplicate test blocks', 'rebase validation', 'run range-diff', 'lost code during rebase', 'rebase artifacts', 'conflict resolution verification'."
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Agent
license: MIT
compatibility: "Requires git. Optional CLI tools (graceful degradation): sem, weave, jscpd (via npx), ast-grep, python3 (Step 2 summarizer)."
---

# Rebase Validation — Five-Layer Pipeline

Validate a git rebase for lost code, duplicate blocks, broken refs, and stale
references using five complementary layers. No single tool catches all rebase
regressions — the value is in layered defense.

## When to Use

- After completing any rebase with conflict resolution
- After `git rebase --update-refs` on a stacked branch set
- When comparing a rebased branch against the original
- When the user suspects code was lost or duplicated during rebase

## Quick Start

If the user just finished a rebase and wants validation, run this sequence:

```
Step 0: Verify refs (are we comparing the right things?)
Step 1: git range-diff -s (commit overview — seconds)
Step 2: sem diff --format json (entity-level — if sem is available)
Step 3: weave preview target (merge readiness — if weave is available)
Step 4: jscpd + duplicate grep (token-level — catches what sem misses)
Step 5: project validation suite (functional oracle)
```

Always run Step 0 first. After Step 0 completes, Steps 1-4 can run as parallel
agents. Step 5 is the final oracle. On agents without a parallel-Agent tool,
run Steps 1-4 sequentially — they're independent.

## Step 0: Verify Refs

Before ANY comparison, confirm refs point where expected. A broken ref makes
every subsequent comparison meaningless.

```bash
# Confirm branch positions
git rev-parse --short <rebased-branch>
git rev-parse --short <original-branch>

# Confirm ancestry
git merge-base --is-ancestor <expected-base> <rebased-branch> && echo "OK" || echo "WRONG BASE"
```

**Why this matters**: `git rebase --update-refs` silently moves ALL branch refs
pointing to commits in the replayed range — including backup branches. If you
created a backup before rebase and it was in the replayed range, it got moved.

**Safe backup strategy**: use tags (not branches) for pre-rebase snapshots, or
create backup branches pointing to commits OUTSIDE the range being replayed.

**Optional safety check** — if no pre-rebase snapshot exists, `git reflog` can
show where the branch pointed before rebase:
```bash
git reflog <rebased-branch> | head -5
```

## Step 1: `git range-diff -s` (Commit-Level)

The single most important first check. Gives a complete overview in seconds.

```bash
# Using remote as "before" snapshot (most practical if pushed before rebase)
git range-diff -s origin/old-branch..origin/old-tip  new-base..new-tip

# Using pre-rebase tags
git range-diff -s pre-rebase/branch..old-tip  new-base..new-tip

# Immediately after rebase (reflog — only works for the tip branch)
# Assumes @{u} has not moved since the rebase (e.g. no force-push to upstream)
git range-diff @{u} @{1} @
```

### Reading the output

| Symbol | Meaning | Action |
|--------|---------|--------|
| `=` | Identical patch | No review needed |
| `!` | Altered (conflict resolution changed content) | **Review these** |
| `<` | Dropped (only in old range) | Verify intentional |
| `>` | Added (only in new range) | Verify expected |

Use `--creation-factor=90` for rebases with heavy conflict resolution — the
default (60) can misclassify heavily-resolved commits as drop+add instead of
altered. The algorithm builds a cost matrix via "diff of diffs" and solves
least-cost assignment — higher creation-factor values make it more forgiving
of large changes when pairing commits.

Additional useful flags:
- `--left-only` — suppress commits missing from the old range (show only
  what's new or changed)
- `--right-only` — suppress commits missing from the new range (show only
  what was dropped or changed)

**Note**: range-diff ignores merge commits by default. This is correct for
rebases (which linearize history) but matters if comparing branches that
contain merges.

For a quick count:
```bash
git range-diff -s ... | grep -c '='   # identical
git range-diff -s ... | grep -c '!'   # altered (review these)
git range-diff -s ... | grep -c '<'   # dropped
git range-diff -s ... | grep -c '>'   # added
```

## Step 2: `sem diff` (Entity-Level)

Compares named code entities between branches. See
`references/silent-behaviors.md` for limitations.

```bash
sem diff --format json old-branch..new-branch
# Alternative syntax if dotdot doesn't work:
# sem diff --from old-branch --to new-branch --format json
```

Summarize by change type and file:
```bash
sem diff --format json old-branch..new-branch | python3 -c "
import json, sys, collections
data = json.load(sys.stdin)
by_type = collections.Counter(c['changeType'] for c in data['changes'])
by_file = collections.Counter(c['filePath'] for c in data['changes'])
for t, n in by_type.most_common(): print(f'  {t}: {n}')
print()
for f, n in by_file.most_common(15): print(f'  {n:3d} {f}')
"
```

Focus on `added` entities (backup has, rebased doesn't) — these are potential
losses. Filter out intentionally deleted files before investigating.

**Check availability first**:
```bash
command -v sem >/dev/null 2>&1 || echo "sem not installed — skipping to Step 3"
```

## Step 3: `weave preview` (Merge Readiness)

After a successful rebase onto target, this should show 0 conflicts.

```bash
weave preview target-branch
```

If conflicts remain, the rebase didn't fully resolve all divergences. This is
normal if target has commits not yet in the rebased branch.

**Check availability first**:
```bash
command -v weave >/dev/null 2>&1 || echo "weave not installed — skipping to Step 4"
```

## Step 4: Duplicate Detection (Token-Level)

This layer catches what sem/weave miss — they cannot parse ~40% of test files.

### 4a: jscpd for duplicate code blocks

```bash
npx --yes jscpd . --ignore "node_modules/**,dist/**,.git/**" --min-lines 5 --min-tokens 50 --max-lines 5000 --reporters console
```

**CRITICAL**: `--max-lines` defaults to 1000 — files over 1000 lines are
**silently skipped**. Always pass `--max-lines 5000`.

Compare clone count against baseline (if available) to distinguish pre-existing
from rebase-introduced duplicates.

### 4b: Duplicate test name grep

```bash
# Adapt the find path to match the project's test directory layout
while IFS= read -r -d '' f; do
  dupes=$(grep -oE "(it|test)\(['\"\`][^'\"\`]*['\"\`]" "$f" | sort | uniq -d)
  [ -n "$dupes" ] && echo "DUPLICATE in $f:" && echo "$dupes"
done < <(find . -path ./node_modules -prune -o \( -name '*.spec.js' -o -name '*.test.js' \) -print0 2>/dev/null)
```

`node:test` silently runs both copies of duplicate `it()` blocks — no warning.
Cross-scope duplicates (same name in different `describe()` blocks) are usually
intentional. Same-scope duplicates are bugs.

### 4c: ast-grep for structural patterns (optional)

If `ast-grep` is installed (`brew install ast-grep`), it can complement jscpd
with **structural** pattern matching — finding code that matches a known shape
rather than detecting unknown duplicates:

```bash
command -v sg >/dev/null 2>&1 || echo "ast-grep not installed — skipping"

# Find all test blocks (useful for manual review of test structure)
sg -p 'it($NAME, $$$BODY)' -l js .

# Find all describe blocks wrapping test blocks
sg -p 'describe($NAME, $$$BODY)' -l js .
```

ast-grep is a search tool, not a clone detector — it finds known patterns,
while jscpd finds unknown duplicates. Use ast-grep when you know what rebase
artifact to look for. No silent file-size thresholds (unlike jscpd).

## Step 5: Functional Verification

The definitive oracle. Every other layer is advisory.

Run the project's full validation suite — lint, type checking, and tests.
Adapt these commands to the project's setup:

```bash
# Example (adapt to your project)
npm run check       # or: cargo check, go vet, etc.
npm test            # or: cargo test, go test ./..., etc.
```

Duplicate test blocks pass both lint and tests — they are invisible to this
layer. That's why Layer 4 exists.

## Baseline Establishment (Before Rebase)

If you haven't rebased yet, run these first to establish a baseline:

```bash
# Save baseline duplicate counts (adapt paths to project layout)
npx --yes jscpd . --ignore "node_modules/**,dist/**,.git/**" --min-lines 5 --min-tokens 50 --max-lines 5000 --reporters console > /tmp/jscpd-baseline.txt

# Save baseline duplicate test names (per-file, same approach as main check)
while IFS= read -r -d '' f; do
  dupes=$(grep -oE "(it|test)\(['\"\`][^'\"\`]*['\"\`]" "$f" | sort | uniq -d)
  [ -n "$dupes" ] && echo "$f: $dupes"
done < <(find . -path ./node_modules -prune -o \( -name '*.spec.js' -o -name '*.test.js' \) -print0 2>/dev/null) > /tmp/test-names-baseline.txt

# Tag all branch tips (for range-diff after rebase)
for b in branch1 branch2 branch3; do
  git tag "pre-rebase/$b" "$b"
done
```

Without baselines, every finding during verification requires manual
investigation to determine if it's pre-existing or rebase-introduced.

## Agent Delegation Pattern

This pattern is optimized for Claude Code's Agent tool. On other agents,
treat the agent list as a sequential checklist — order doesn't matter
beyond Step 0 first, Step 5 last.

For large rebases, delegate verification to parallel agents:

```
Agent 1: git range-diff -s (commit correspondence)
Agent 2: sem diff --format json (entity-level, if available)
Agent 3: weave preview target (merge readiness, if available)
Agent 4: jscpd + grep (duplicate detection)
Agent 5: project validation suite (lint + types + tests)
```

Launch all 5 immediately after rebase (in parallel where supported,
sequentially otherwise). Check `range-diff` and `jscpd` results first
(arrive in seconds, highest signal). The gap between "rebase complete"
and "verification results" is dangerous — kick off verification immediately,
decide nothing until results arrive.

## Classifying Findings

| Finding | Classification | Action |
|---------|---------------|--------|
| `!` commit in range-diff | Conflict resolution | Review the diff-of-diff |
| `added` entity in sem (backup-only) | Potential loss | Check if intentionally deleted |
| Duplicate test block (same describe scope) | Rebase artifact | Delete the stale copy |
| Duplicate test name (cross describe scope) | Pre-existing pattern | Note for future cleanup |
| weave conflict | Unresolved divergence | Expected if target moved forward |
| lint/type error | Rebase artifact | Fix immediately |

## Further Reading

See `references/silent-behaviors.md` for the silent exclusion thresholds that
make test files invisible to sem/weave/jscpd.
