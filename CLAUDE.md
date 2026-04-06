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
      tool-thresholds.md                 # Silent exclusion thresholds for sem/weave/jscpd
validate-plugin.mjs                      # Structural validator (the only JS in the repo)
```

Pure markdown + JSON plugin. The only code is `validate-plugin.mjs`.

## Components

### Skills (1)

- **rebase-validate** -- Five-layer pipeline for verifying rebase correctness:
  ref verification, range-diff, sem diff, weave preview, duplicate detection,
  and functional oracle. Degrades gracefully when sem/weave are not installed.
  User-invocable as `/rebase-validate`.

## Development

```bash
npm run check          # run all checks (parallel via npm-run-all2)
npm run check:plugin   # plugin.json + skill frontmatter validation
npm run check:md       # markdown lint (remark)
```

### What the Validator Checks

`validate-plugin.mjs` validates structural correctness across all plugin
component types. It checks whichever components exist:

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

### Optional External Tools

The rebase-validate skill works best with
[sem](https://github.com/Ataraxy-Labs/sem) and
[weave](https://github.com/Ataraxy-Labs/weave) installed but degrades
gracefully without them. See `skills/rebase-validate/references/tool-thresholds.md`
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
