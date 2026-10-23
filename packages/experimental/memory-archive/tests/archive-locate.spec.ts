import { describe, expect, it } from 'vitest'
import { sectionTargetPath } from '../src/archive-locate.ts'
import type { ArchiveSection } from '../src/archive-index.ts'

const section = (patch: Partial<ArchiveSection>): ArchiveSection =>
  ({ name: 'x', path: 'x', kind: 'reference', level: 'free', warning: 'none', ...patch })

describe('sectionTargetPath', () => {
  it('points a reference section at its own file', () => {
    expect(sectionTargetPath(section({ path: 'about.md' }), '2026-10-22')).toBe('about.md')
  })

  it('splits a daily section into year-month folders', () => {
    expect(sectionTargetPath(section({ kind: 'append', layout: 'daily', path: 'notes/' }), '2026-10-22'))
      .toBe('notes/2026-10/2026-10-22.md')
  })

  it('keeps a single section in one file', () => {
    expect(sectionTargetPath(section({ kind: 'append', layout: 'single', path: 'notes.md' }), '2026-10-22'))
      .toBe('notes.md')
  })
})
