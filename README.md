# vp-git

A [Claude Code](https://claude.ai/code) plugin providing git workflow safety
skills for rebase validation, merge auditing, and stacked PR management.

## Install

```bash
claude plugins add /path/to/vp-git
# or from GitHub:
claude plugins add voxpelli/claude-git
```

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
