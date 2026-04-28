# vp-git

A [Claude Code](https://claude.ai/code) plugin providing git workflow safety
skills for rebase validation, merge auditing, and stacked PR management.

## Install

```bash
claude plugins add /path/to/vp-git
# or from GitHub:
claude plugins add voxpelli/claude-git
```

## Install (without the plugin)

The skills in this repo follow the [open Agent Skills standard](https://agentskills.io)
and can be installed individually into any compatible agent (Claude Code,
Cursor, Codex CLI, Gemini CLI, GitHub Copilot, Kiro, …):

```bash
npx skills add voxpelli/claude-git
```

The `skills` CLI auto-detects the target agent and writes into the correct
directory (`~/.claude/skills/`, `~/.cursor/skills/`, etc.).

**Note:** If you've already installed via `claude plugins add`, you don't
need this — the plugin already provides the skill. Mixing both installs
places the same `rebase-validate` skill in two locations and relies on
Claude Code's resolution order to dedupe.

## Skills

- **`/rebase-validate`** -- Five-layer pipeline for verifying rebase
  correctness: ref verification, range-diff, sem diff, weave preview,
  duplicate detection, and functional tests.

## Optional Tools

The plugin works best with [sem](https://github.com/Ataraxy-Labs/sem) and
[weave](https://github.com/Ataraxy-Labs/weave) installed, but degrades
gracefully without them.

```bash
brew install sem-cli weave
```

## License

MIT
