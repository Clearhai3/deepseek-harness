import { describe, expect, it } from 'vitest'
import { decideWrite } from '../src/archive-policy.ts'
import type { ArchiveSection } from '../src/archive-index.ts'

const section = (level: ArchiveSection['level']): ArchiveSection =>
  ({ name: 'x', path: 'x', kind: 'append', layout: 'single', level, warning: 'none' })

describe('decideWrite', () => {
  it('allows free without a trail', () => {
    expect(decideWrite(section('free'))).toEqual({ allowed: true, needsTrail: false })
  })

  it('allows soft but demands a trail', () => {
    expect(decideWrite(section('soft'))).toEqual({ allowed: true, needsTrail: true })
  })

  it('refuses gated and says why', () => {
    const decision = decideWrite(section('gated'))
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toMatch(/gated/u)
  })
})
