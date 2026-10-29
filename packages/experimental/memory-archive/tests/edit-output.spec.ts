import { describe, expect, it } from 'vitest'
import type { EditResult } from '../src/archive-edit.ts'
import { renderEdit } from '../src/edit-output.ts'

const BASE: EditResult = { section: 'memory', path: 'memory.md', line: 7, before: '旧', after: '新', changed: true }

describe('renderEdit', () => {
  it('names the file and the line, then the before and after', () => {
    expect(renderEdit(BASE)).toBe('Edited memory -> memory.md:7.\nBefore: 旧\nAfter:  新')
  })

  it('says so when nothing changed and hides the diff', () => {
    expect(renderEdit({ ...BASE, changed: false })).toBe('Unchanged memory -> memory.md:7.')
  })

  it('reports the trail when a soft section was edited', () => {
    expect(renderEdit({ ...BASE, trail: { path: 'notes/2026-10/2026-10-22.md' } }))
      .toContain('Trail: notes/2026-10/2026-10-22.md (soft section: the edit is logged).')
  })
})
