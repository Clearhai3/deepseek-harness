import { describe, expect, it } from 'vitest'
import { parseArchiveIndex, SECTION_KINDS } from '../src/archive-index.ts'

const VALID = `version: 1
sections:
  - name: identity
    path: .github/copilot-instructions.md
    kind: always-loaded
    description: I am who I am
  - name: journal
    path: journal/
    kind: append
`

describe('archive index', () => {
  it('reads sections in declaration order', () => {
    expect(parseArchiveIndex(VALID)).toEqual({
      version: 1,
      sections: [
        { name: 'identity', path: '.github/copilot-instructions.md', kind: 'always-loaded', description: 'I am who I am' },
        { name: 'journal', path: 'journal/', kind: 'append' },
      ],
    })
  })

  it('accepts every declared section kind', () => {
    const declared = SECTION_KINDS
      .map(kind => `  - name: ${kind}\n    path: ${kind}\n    kind: ${kind}`)
      .join('\n')
    expect(parseArchiveIndex(`version: 1\nsections:\n${declared}\n`).sections.map(section => section.kind))
      .toEqual([...SECTION_KINDS])
  })

  it('rejects YAML that does not parse', () => {
    expect(() => parseArchiveIndex('version: [')).toThrow(/not valid YAML/u)
  })

  it('rejects a document that is not a mapping', () => {
    expect(() => parseArchiveIndex('- 1')).toThrow(/must be a mapping/u)
  })

  it('rejects a missing or unsupported version', () => {
    expect(() => parseArchiveIndex('sections: []')).toThrow(/unsupported version/u)
    expect(() => parseArchiveIndex('version: 2\nsections: []')).toThrow(/unsupported version/u)
  })

  it('rejects a missing or empty section list', () => {
    expect(() => parseArchiveIndex('version: 1')).toThrow(/non-empty list/u)
    expect(() => parseArchiveIndex('version: 1\nsections: []')).toThrow(/non-empty list/u)
  })

  it('rejects a section that is not a mapping', () => {
    expect(() => parseArchiveIndex('version: 1\nsections: [1]')).toThrow(/sections\[0\] must be a mapping/u)
  })

  it('rejects an empty name and a duplicate name', () => {
    expect(() => parseArchiveIndex('version: 1\nsections:\n  - name: ""\n    path: a\n    kind: reference'))
      .toThrow(/sections\[0\]\.name must be a non-empty string/u)
    expect(() => parseArchiveIndex('version: 1\nsections:\n  - name: a\n    path: a\n    kind: reference\n  - name: a\n    path: b\n    kind: reference'))
      .toThrow(/duplicate section name/u)
  })

  it('rejects an unknown kind', () => {
    expect(() => parseArchiveIndex('version: 1\nsections:\n  - name: a\n    path: a\n    kind: writable'))
      .toThrow(/kind must be one of/u)
  })

  it('rejects a non-string description', () => {
    expect(() => parseArchiveIndex('version: 1\nsections:\n  - name: a\n    path: a\n    kind: reference\n    description: 1'))
      .toThrow(/description must be a string/u)
  })

  it('rejects a path that leaves the archive root', () => {
    const entry = (path: string): string =>
      `version: 1\nsections:\n  - name: a\n    path: ${JSON.stringify(path)}\n    kind: reference`
    for (const path of ['', '/etc/passwd', '..', '../x', 'a\\b']) {
      expect(() => parseArchiveIndex(entry(path))).toThrow(/path must/u)
    }
  })
})
