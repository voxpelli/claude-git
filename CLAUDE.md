# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin (`vp-git`) providing git workflow safety skills for rebase
validation, merge auditing, and stacked PR management. These skills codify
hard-won operational knowledge from real large-scale rebases into reusable,
agent-assisted workflows.

## Plugin Layout

```
.claude-plugin/
  plugin.json                            # Plugin manifest
skills/
  rebase-validate/SKILL.md               # Five-layer rebase validation pipeline
    references/
      silent-behaviors.md                 # Silent behaviors: tool thresholds, rerere, --update-refs
plugin-utils.mjs                         # Shared helpers (ROOT, formatError/Warn, extractFrontmatter)
validate-plugin.mjs                      # Layer 1: structural validator (plugin.json + frontmatter)
check-portability.mjs                    # vp-git-specific: skills.sh portability warnings
skill-check.config.json                  # thedaviddias/skill-check config (rule suppressions)
```

## Components

### Skills (1)

- **rebase-validate** -- Five-layer pipeline for verifying rebase correctness:
  ref verification, range-diff, sem diff, weave preview, duplicate detection,
  and functional oracle. Degrades gracefully when sem/weave are not installed.
  User-invocable as `/rebase-validate`.

## Development

```bash
npm run check               # run all checks (parallel via npm-run-all2)
npm run check:plugin        # Layer 1 — plugin.json + frontmatter (validate-plugin.mjs)
npm run check:md            # markdown lint (remark)
npm run check:spec          # agentskills.io spec compliance (skill-check)
npm run check:portability   # vp-git-specific: skills.sh portability (warn-only)
```

### What the Checks Cover

**Layer 1 -- `validate-plugin.mjs`**: structural correctness across all
plugin component types. Checks whichever components exist:

- **plugin.json** -- required fields (`name`, `version`, `description`)
- **marketplace.json** -- version consistency with plugin.json (if present)
- **Skills** (`skills/*/SKILL.md`) -- required frontmatter fields: `name`,
  `description`, `user-invocable`, `allowed-tools`. Validates MCP tool prefixes
  and audits that tools referenced in skill prose appear in `allowed-tools`
- **Agents** (`agents/*.md`) -- required frontmatter: `name`, `description`,
  `model`, `color`, `tools`. Validates color/model enums, phantom skill
  references, and MCP prefixes (if `agents/` exists)
- **Hooks** (`hooks/hooks.json`) -- hook type enums, timeout presence, command
  script existence (if `hooks/` exists)

**Spec compliance -- `skill-check` (pilot)**: 22-rule validator from
the `thedaviddias/skill-check` npm package, invoked via npx. Covers
length caps, name regex, frontmatter shape, description quality, body
structure, link health, and quality scoring (0-100). Configuration in
`skill-check.config.json` suppresses two rules that conflict with
Claude Code conventions (`frontmatter.allowed_tools_format` —
Claude Code uses array; `frontmatter.unknown_fields` — Claude Code
defines `user-invocable`, `paths`, `effort`, `skills`). **Pilot status**
— this is an experiment for vp-git, not a recommendation. Reassess
after a release cycle.

**Portability -- `check-portability.mjs`** (warn-only, vp-git specific):
flags `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}` references and
`../` path escapes that break under skills.sh symlinked install.
Honors `claude-only: true` frontmatter to opt out of the check.

### Optional External Tools

The rebase-validate skill works best with
[sem](https://github.com/Ataraxy-Labs/sem) and
[weave](https://github.com/Ataraxy-Labs/weave) installed but degrades
gracefully without them. See `skills/rebase-validate/references/silent-behaviors.md`
for their silent exclusion thresholds.

## Design Principles

- **Layered defense** -- no single tool catches all rebase regressions. Each
  skill layer compensates for another's blind spots.
- **Graceful degradation** -- skills detect tool availability and skip layers
  when tools are missing, rather than failing.
- **Generic by default** -- skills work across ecosystems (npm, cargo, go).
  Project-specific commands are marked as examples.
- **Agent-assisted** -- skills document delegation patterns for parallel
  verification via Claude Code's Agent tool.
