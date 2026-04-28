import { relative } from 'node:path'

import yaml from 'js-yaml'

export const ROOT = new URL('.', import.meta.url).pathname.replace(/\/$/, '')

/**
 * @param {string} file
 * @param {string} message
 * @returns {string}
 */
export function formatError (file, message) {
  return `${relative(ROOT, file)}: ${message}`
}

/**
 * @param {string} file
 * @param {string} message
 * @returns {string}
 */
export function formatWarn (file, message) {
  return `${relative(ROOT, file)}: ${message}`
}

/**
 * @param {string} content
 * @returns {Record<string, unknown> | undefined}
 */
export function extractFrontmatter (content) {
  // Normalize CRLF — the frontmatter regex `^---\n...\n---` won't
  // match `---\r\n...` if a Windows contributor commits with autocrlf
  const normalized = content.replace(/\r\n/g, '\n')
  const match = normalized.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return undefined
  try {
    const parsed = yaml.load(match[1])
    return typeof parsed === 'object' && parsed !== null
      ? /** @type {Record<string, unknown>} */ (parsed)
      : undefined
  } catch {
    return undefined
  }
}
