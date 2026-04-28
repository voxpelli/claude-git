import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { ROOT, formatError, formatWarn, extractFrontmatter } from './plugin-utils.mjs'

const { values } = parseArgs({
  options: {
    full: { type: 'boolean', default: false },
    root: { type: 'string' },
  },
  strict: true,
})

// resolve() handles both relative (against cwd) and absolute paths; join() would
// silently produce wrong results when --root receives an absolute path.
const skillsRoot = values.root ? resolve(values.root) : ROOT

/** @type {string[]} */
const errors = []

/** @type {string[]} */
const warnings = []

/**
 * @param {string} file
 * @param {string} message
 */
function error (file, message) {
  errors.push(formatError(file, message))
}

/**
 * @param {string} file
 * @param {string} message
 */
function warn (file, message) {
  warnings.push(formatWarn(file, message))
}

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const XML_BRACKET_RE = /<[a-zA-Z]|<\//
const TRIGGER_KEYWORDS = ['use', 'when', 'validate', 'check', 'run', 'compare', 'verify', 'detect']
const VOICE_OPENER_RE = /^(this skill|validates|checks|runs|compares|detects|provides)/i

const PORTABLE_VARS = /\$\{CLAUDE_PLUGIN_ROOT\}|\$\{CLAUDE_SKILL_DIR\}/g
const PATH_ESCAPE = /\.\.\//g

/**
 * @param {unknown} v
 * @returns {string}
 */
function stringifyValue (v) {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').join(' ')
  return String(v)
}

/**
 * Lite Rule 1 — length caps.
 * @param {string} file
 * @param {Record<string, unknown>} fm
 */
function checkLengthCaps (file, fm) {
  if (typeof fm.name === 'string' && fm.name.length > 64) {
    error(file, `name exceeds 64 chars (${fm.name.length})`)
  }
  if (typeof fm.description === 'string' && fm.description.length > 1024) {
    error(file, `description exceeds 1024 chars (${fm.description.length})`)
  }
  if ('compatibility' in fm) {
    const c = fm.compatibility
    const len = Array.isArray(c) ? c.join(' ').length : (typeof c === 'string' ? c.length : 0)
    if (len > 500) {
      error(file, `compatibility exceeds 500 chars (${len})`)
    }
  }
}

/**
 * Lite Rule 2 — name regex + parent-dir match.
 * @param {string} file
 * @param {Record<string, unknown>} fm
 */
function checkName (file, fm) {
  if (typeof fm.name !== 'string') return
  if (!NAME_RE.test(fm.name)) {
    error(file, `name "${fm.name}" must match /^[a-z0-9]+(-[a-z0-9]+)*$/ (lowercase alnum runs separated by single hyphens)`)
    return
  }
  const parentDir = basename(dirname(file))
  if (parentDir !== fm.name) {
    error(file, `name "${fm.name}" does not match parent directory "${parentDir}"`)
  }
}

/**
 * Lite Rule 3 — no XML angle brackets in frontmatter values.
 * @param {string} file
 * @param {Record<string, unknown>} fm
 */
function checkXmlBrackets (file, fm) {
  for (const [key, value] of Object.entries(fm)) {
    const s = stringifyValue(value)
    if (XML_BRACKET_RE.test(s)) {
      error(file, `frontmatter "${key}" contains XML-style angle brackets — these can inject system-prompt instructions and are forbidden by spec`)
    }
  }
}

/**
 * Lite Rule 4 — body portability (warn-only).
 * Walks the skill directory, scans .md/.sh/.txt files for non-portable
 * references that break cross-agent install via skills.sh.
 * `fm` is reserved for a future `claude-only: true` opt-out (deferred).
 * @param {string} skillDir
 * @param {Record<string, unknown>} _fm
 */
async function checkBodyPortability (skillDir, _fm) {
  /** @type {string[]} */
  let files
  try {
    files = await readdir(skillDir, { recursive: true })
  } catch {
    return
  }
  const targets = files
    .map((f) => join(skillDir, f))
    .filter((p) => /\.(md|sh|txt)$/.test(p))

  for (const filePath of targets) {
    let raw
    try {
      raw = await readFile(filePath, 'utf8')
    } catch {
      continue
    }
    const normalized = raw.replace(/\r\n/g, '\n')
    // Strip frontmatter so `compatibility:` text doesn't false-positive
    const body = normalized.replace(/^---\n[\s\S]*?\n---/, '')

    // Reset stateful /g regex lastIndex at the top of every file iteration
    PORTABLE_VARS.lastIndex = 0
    PATH_ESCAPE.lastIndex = 0

    if (PORTABLE_VARS.test(body)) {
      warn(filePath, 'contains ${CLAUDE_PLUGIN_ROOT} or ${CLAUDE_SKILL_DIR} — will not resolve outside Claude Code plugin loader')
    }
    if (PATH_ESCAPE.test(body)) {
      warn(filePath, "contains '../' path escape — may break under skills.sh symlinked install")
    }
  }
}

/**
 * Full-only Rule 5 — description quality heuristic.
 * @param {string} file
 * @param {Record<string, unknown>} fm
 */
function checkDescriptionQuality (file, fm) {
  if (typeof fm.description !== 'string') return
  const desc = fm.description
  const lower = desc.toLowerCase()
  const hits = TRIGGER_KEYWORDS.filter((k) => lower.includes(k)).length
  if (hits < 2) {
    warn(file, `description has ${hits} trigger keyword(s) — fewer than 2 reduces discoverability (try: ${TRIGGER_KEYWORDS.join(', ')})`)
  }
  if (!VOICE_OPENER_RE.test(desc.trim())) {
    warn(file, 'description should open in third-person voice (e.g., "Validates...", "Checks...", "This skill...")')
  }
}

// --- Main ---

const skillsDir = join(skillsRoot, 'skills')
if (!existsSync(skillsDir)) {
  console.error(`No skills directory at ${skillsDir}`)
  process.exit(1)
}

const skillFiles = (await readdir(skillsDir, { recursive: true }))
  .filter((f) => f.endsWith('SKILL.md'))
  .map((f) => join(skillsDir, f))

for (const file of skillFiles) {
  const content = await readFile(file, 'utf8')
  const fm = extractFrontmatter(content)
  if (!fm) {
    error(file, 'Missing or invalid YAML frontmatter')
    continue
  }
  checkLengthCaps(file, fm)
  checkName(file, fm)
  checkXmlBrackets(file, fm)
  await checkBodyPortability(dirname(file), fm)
  if (values.full) {
    checkDescriptionQuality(file, fm)
  }
}

// --- Report ---

if (warnings.length > 0) {
  console.warn('Skill spec validation warnings:\n')
  for (const w of warnings) {
    console.warn(`  ~ ${w}`)
  }
  console.warn('')
}

if (errors.length > 0) {
  console.error('Skill spec validation failed:\n')
  for (const e of errors) {
    console.error(`  - ${e}`)
  }
  console.error(`\n${errors.length} error(s) found.`)
  process.exit(1)
} else {
  console.log(`Skill spec validation passed${values.full ? ' (full mode)' : ''}.`)
}
