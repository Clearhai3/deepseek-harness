import { describe, expect, it } from 'vitest'
import { loadArchiveSkill, parseSkillDocument } from '../src/archive-skill.ts'

const OK = '---\nname: demo\ndescription: does a thing\n---\n\n# Body\n\ntext\n'

describe('parseSkillDocument', () => {
  it('splits frontmatter from the body', () => {
    expect(parseSkillDocument(OK)).toEqual({ name: 'demo', description: 'does a thing', content: '# Body\n\ntext' })
  })

  it('refuses a document without frontmatter', () => {
    expect(() => parseSkillDocument('# no frontmatter\n')).toThrow(/no YAML frontmatter/u)
  })

  it('refuses frontmatter that is not a mapping', () => {
    expect(() => parseSkillDocument('---\njust a string\n---\n\nbody\n')).toThrow(/no YAML frontmatter/u)
  })

  it('refuses a missing name', () => {
    expect(() => parseSkillDocument('---\ndescription: d\n---\n\nbody\n')).toThrow(/has no name/u)
  })

  it('refuses a missing description', () => {
    expect(() => parseSkillDocument('---\nname: n\n---\n\nbody\n')).toThrow(/has no description/u)
  })
})

describe('loadArchiveSkill', () => {
  it('loads the shipped skill', () => {
    const skill = loadArchiveSkill()
    expect(skill.name).toBe('memory-archive')
    expect(skill.description.length).toBeGreaterThan(0)
    expect(skill.content.startsWith('# Memory archive')).toBe(true)
  })
})
