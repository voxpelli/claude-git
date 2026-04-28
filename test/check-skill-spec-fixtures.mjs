import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = dirname(__dirname)
const VALIDATOR = join(REPO_ROOT, 'check-skill-spec.mjs')

/**
 * @typedef {object} FixtureCase
 * @property {string} fixture                   Fixture directory name under test/fixtures/
 * @property {boolean} [full]                   Run with --full
 * @property {0 | 1} expectExit
 * @property {string[]} expectMatches           Substrings that MUST appear in combined stdout/stderr
 * @property {string[]} [expectAbsent]          Substrings that MUST NOT appear
 */

/** @type {FixtureCase[]} */
const cases = [
  {
    fixture: 'valid-skill',
    expectExit: 0,
    expectMatches: ['Skill spec validation passed'],
    expectAbsent: ['error', 'warning'],
  },
  {
    fixture: 'valid-skill',
    full: true,
    expectExit: 0,
    expectMatches: ['Skill spec validation passed (full mode)'],
    expectAbsent: ['error', 'warning'],
  },
  {
    fixture: 'bad-length',
    expectExit: 1,
    expectMatches: ['description exceeds 1024'],
  },
  {
    fixture: 'bad-name-caps',
    expectExit: 1,
    expectMatches: ['Rebase-Validate', 'must match'],
  },
  {
    fixture: 'bad-name-leading-hyphen',
    expectExit: 1,
    expectMatches: ['-rebase', 'must match'],
  },
  {
    fixture: 'bad-name-mismatch',
    expectExit: 1,
    expectMatches: ['does not match parent directory'],
  },
  {
    fixture: 'bad-xml-brackets',
    expectExit: 1,
    expectMatches: ['XML-style angle brackets'],
  },
  {
    fixture: 'bad-portability',
    expectExit: 0,
    expectMatches: ['${CLAUDE_PLUGIN_ROOT}', "'../'"],
    expectAbsent: ['error(s) found'],
  },
  {
    fixture: 'bad-quality',
    expectExit: 0,
    expectMatches: ['Skill spec validation passed'],
    expectAbsent: ['warning'],
  },
  {
    fixture: 'bad-quality',
    full: true,
    expectExit: 0,
    expectMatches: ['trigger keyword', 'third-person voice'],
    expectAbsent: ['error(s) found'],
  },
]

let failed = 0

for (const c of cases) {
  const args = ['--root', join('test', 'fixtures', c.fixture)]
  if (c.full) args.push('--full')
  const result = spawnSync('node', [VALIDATOR, ...args], { cwd: REPO_ROOT, encoding: 'utf8' })
  const combined = `${result.stdout}\n${result.stderr}`
  const label = `${c.fixture}${c.full ? ' --full' : ''}`

  try {
    assert.equal(result.status, c.expectExit, `expected exit ${c.expectExit}, got ${result.status}`)
    for (const m of c.expectMatches) {
      assert.ok(combined.includes(m), `expected output to contain "${m}"`)
    }
    for (const m of c.expectAbsent ?? []) {
      assert.ok(!combined.includes(m), `expected output to NOT contain "${m}"`)
    }
    console.log(`  ✓ ${label}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${label}`)
    console.error(`    ${/** @type {Error} */ (err).message}`)
    console.error(`    --- captured output ---`)
    console.error(combined.split('\n').map((l) => `    ${l}`).join('\n'))
  }
}

if (failed > 0) {
  console.error(`\n${failed} fixture case(s) failed.`)
  process.exit(1)
}
console.log(`\n${cases.length} fixture case(s) passed.`)
