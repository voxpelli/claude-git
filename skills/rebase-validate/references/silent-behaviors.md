# Silent Behaviors

Three validation tools have thresholds that silently exclude files from
analysis. No warning, no error — the file is simply absent from results.

## Threshold Matrix

| Tool | Threshold | Default | Effect | Workaround |
|------|-----------|---------|--------|------------|
| sem/weave | File size | 32KB hard limit | File invisible to entity extraction | Keep files under 30KB; split large files |
| weave | Same-name entities | `WEAVE_MAX_DUPLICATES=10` | Line-level fallback for entire file | Set `WEAVE_MAX_DUPLICATES=30` or use descriptive test names |
| jscpd | Line count | `--max-lines 1000` | File silently skipped, zero output | Always pass `--max-lines 5000` |

## sem/weave: 32KB Buffer Limit

The tree-sitter Node.js binding has a hard 32KB (`32,768` byte) buffer limit.
Files exceeding this cannot be parsed at all.

Additionally, sem only extracts 4 entity types from JavaScript:
- `function_declaration` (named functions)
- `class_declaration` (classes)
- `variable_declarator` (const/let/var assignments)
- `export_statement` (exports)

Test constructs (`describe()`, `it()`, `test()`) are **call expressions** —
never extracted regardless of file size. This makes ~40% of test files produce
zero entities even when they are under the 32KB limit.

**Design constraint**: keep test files under 30KB. When a file approaches this
limit, split it into focused modules.

## weave: WEAVE_MAX_DUPLICATES

When a file has more than 10 entities with the same name, weave skips
entity-level merge for that file and falls back to line-level. Test files with
many similarly-named `it()` or `test()` blocks across `describe()` scopes
frequently exceed this threshold.

```bash
# Override for a specific merge
WEAVE_MAX_DUPLICATES=30 git merge branch-name
```

## jscpd: --max-lines

The default `--max-lines 1000` silently skips any file with more than 1000
lines. The skip is completely silent — no message, no error, zero clones
reported for that file.

```bash
# Always specify explicitly
npx jscpd test/ --max-lines 5000 --min-lines 5 --min-tokens 50 --reporters console
```

## node:test: Silent Duplicate Execution

Not a threshold but a related blind spot: `node:test` silently runs both copies
when two `it()` blocks share the same name in the same `describe()` scope. No
warning, no error, no deduplication. Both pass (or both fail).

Detection options:
- `eslint-plugin-node-core-test` with `no-identical-title` (lint-time)
- grep-based check (see main SKILL.md Step 4b)
- Custom `node:test` reporter (runtime, nesting-aware)

## git rerere: Silent Resolution Replay

If `rerere.enabled = true`, git silently records and replays conflict
resolutions. Matches by exact SHA hash of normalized conflict content. The
main risk is replaying a resolution that was correct in one context but wrong
after surrounding code evolved.

- Keep `rerere.autoupdate` disabled (default) — preserves the review window
- Run `git rerere gc` after large rebases to clean stale entries
- Consider `git rerere forget .` before a new rebase for a clean slate

## git --update-refs: Silent Ref Movement

`git rebase --update-refs` moves ALL branch refs pointing to commits in the
replayed range — not just the branches you intend to update. This includes
backup branches if they point to commits being replayed.

Safe alternatives for pre-rebase snapshots:
- Use `git tag pre-rebase/branch-name` (tags are NOT moved by `--update-refs`)
- Create backup branches pointing to commits OUTSIDE the rebase range
- Use remote tracking branches as the "before" snapshot (most practical if
  already pushed)
