import { describe, expect, it } from 'vitest'
import { approveMapWrite, type MapWriteApprover, type MapWriteOutcome, type MapWriteApproval } from '../src/archive-map-approval.ts'

/** 固定结局的审批器。 */
const approver = (outcome: MapWriteOutcome): MapWriteApprover =>
  ({ request: () => Promise.resolve(outcome) })

/** 默认一套"会批准"的材料；`over` 只换其中一处。 */
const approval = (over: Partial<MapWriteApproval> = {}): MapWriteApproval => ({
  approver: approver('allowed-once'),
  agent: {},
  callId: 'c1',
  toolName: 'archive_map_write',
  ...over,
})

/** 一次典型的地图写入。 */
const request = { reason: '收紧 archive 的写权限', changes: '~ archive · level: free -> gated' }

describe('approveMapWrite', () => {
  it('批准 -> 不抛', async () => {
    await expect(approveMapWrite(request, approval())).resolves.toBeUndefined()
  })

  it('人拒绝 -> 抛，并禁止绕路', async () => {
    await expect(approveMapWrite(request, approval({ approver: approver('rejected') })))
      .rejects.toThrow(/do not retry/)
  })

  it('被取消 -> 抛', async () => {
    await expect(approveMapWrite(request, approval({ approver: approver('cancelled') })))
      .rejects.toThrow(/cancelled/)
  })

  it('审批通道不可用 -> 抛', async () => {
    await expect(approveMapWrite(request, approval({ approver: approver('unavailable') })))
      .rejects.toThrow(/no approval channel/)
  })

  it('没有审批服务 -> 抛', async () => {
    await expect(approveMapWrite(request, approval({ approver: undefined })))
      .rejects.toThrow(/no approval service/)
  })

  it('没有 agent -> 抛', async () => {
    await expect(approveMapWrite(request, approval({ agent: undefined })))
      .rejects.toThrow(/no agent/)
  })

  it('审批请求里同时带原因和变化正文', async () => {
    const seen: Array<{ reason: string }> = []
    await approveMapWrite(request, approval({
      approver: { request: (req) => { seen.push(req); return Promise.resolve('allowed-once') } },
    }))
    expect(seen[0]?.reason).toContain('收紧 archive 的写权限')
    expect(seen[0]?.reason).toContain('free -> gated')
  })
})
