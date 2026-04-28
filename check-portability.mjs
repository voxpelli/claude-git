import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

import { ROOT, formatWarn, extractFrontmatter } from './plugin-utils.mjs'

// vp-git-specific: skills.sh installs skills via filesystem symlinks; bodies that
// hard-code Claude Code's ${CLAUDE_PLUGIN_ROOT}/${CLAUDE_SKILL_DIR} or use ../
// path escapes will not resolve outside the plugin loader. Warn-only — these
// are deviation from cross-agent portability, not hard errors.

const PORTABLE_VARS = /\$\{CLAUDE_PLUGIN_ROOT\}|\$\{CLAUDE_SKILL_DIR\}/g
const PATH_ESCAPE = /\.\.\//g

/** @type {string[]} */
const warnings = []

const skillsDir = join(ROOT, 'skills')
if (!existsSync(skillsDir)) {
  console.log('No skills/ directory; skipping portability check.')
  process.exit(0)
}

const skillFiles = (await readdir(skillsDir, { recursive: true }))
  .filter((f) => f.endsWith('SKILL.md'))
  .map((f) => join(skillsDir, f))

for (const skillFile of skillFiles) {
  const skillContent = await readFile(skillFile, 'utf8')
  const fm = extractFrontmatter(skillContent)
  // Deferred opt-out: skills declaring `claude-only: true` skip portability
  if (fm && fm['claude-only'] === true) continue

  const skillDir = dirname(skillFile)
  const entries = await readdir(skillDir, { recursive: true })
  const targets = entries
    .map((f) => join(skillDir, f))
    .filter((p) => /\.(md|sh|txt)$/.test(p))

  for (const filePath of targets) {
    let raw
    try {
      raw = await readFile(filePath, 'utf8')
    } catch {
      continue
    }
    const body = raw
      .replace(/\r\n/g, '\n')
      .replace(/^---\n[\s\S]*?\n---/, '')

    PORTABLE_VARS.lastIndex = 0
    PATH_ESCAPE.lastIndex = 0

    if (PORTABLE_VARS.test(body)) {
      warnings.push(formatWarn(filePath, '${CLAUDE_PLUGIN_ROOT}/${CLAUDE_SKILL_DIR} will not resolve outside Claude Code; add `claude-only: true` if intentional'))
    }
    if (PATH_ESCAPE.test(body)) {
      warnings.push(formatWarn(filePath, "'../' path escape may break under skills.sh symlinked install"))
    }
  }
}

if (warnings.length > 0) {
  console.warn('Portability warnings:\n')
  for (const w of warnings) console.warn(`  ~ ${w}`)
  console.warn('')
}
console.log(`Portability check passed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}.`)
