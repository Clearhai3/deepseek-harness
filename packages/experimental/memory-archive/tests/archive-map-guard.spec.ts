import { describe, expect, it } from 'vitest'
import { mapCall } from '../src/archive-map-guard.ts'

/** 造一次工具调用：这层只关心名字和参数。 */
const call = (name: string, args: unknown) => ({ name, arguments: args })

describe('mapCall', () => {
  it('放行 allowlist 里的写工具', () => {
    expect(mapCall(call('archive_init', {}))).toBeUndefined()
  })

  it('挡住 write 改地图，并说出是哪条路径', () => {
    const reason = mapCall(call('write', { file_path: '/x/archive.yaml' }))
    expect(reason).toContain('/x/archive.yaml')
  })

  it('挡住相对路径写法', () => {
    expect(mapCall(call('write', { file_path: 'archive.yaml' }))).toBeDefined()
  })

  it('放行只读工具读地图', () => {
    expect(mapCall(call('read', { file_path: '/x/archive.yaml' }))).toBeUndefined()
  })

  it('放行改别的文件', () => {
    expect(mapCall(call('write', { file_path: '/x/about.md' }))).toBeUndefined()
  })

  it('钻进数组里也挡得住', () => {
    expect(mapCall(call('write', { files: [{ path: '/x/archive.yaml' }] }))).toBeDefined()
  })

  it('未知工具默认拒绝', () => {
    expect(mapCall(call('some_new_tool', { file_path: '/x/archive.yaml' }))).toBeDefined()
  })

  it('空参数不炸', () => {
    expect(mapCall(call('write', {}))).toBeUndefined()
  })

  it('文件名只是像，不算命中', () => {
    expect(mapCall(call('write', { note: 'archive.yaml.bak' }))).toBeUndefined()
  })

  it('拒绝的话同时说给模型和人听', () => {
    const reason = mapCall(call('write', { file_path: '/x/archive.yaml' })) ?? ''
    expect(reason).toContain('user')
    expect(reason).toContain('用户')
  })
})
