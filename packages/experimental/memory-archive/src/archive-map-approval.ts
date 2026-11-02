/** 审批的四种结局。结构上等同于审批服务的 `ApprovalOutcome`，但这里不依赖它。 */
export type MapWriteOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

/**
 * 审批通道的最小结构形状。
 * @typeParam A - 调用方自己的 agent 类型。
 * @typeParam C - 调用方自己的 called 类型。
 */
export interface MapWriteApprover<A = object, C = string> {
  /**
     * 请人裁决一次地图写入。
     * @param req - 审批请求；`displayReason` 可带多语言。
     * @returns 一个封闭的 {@link MapWriteOutcome}。
     */
  request(req: {
    agent: A
    toolName: string
    callId: C
    reason: string
    displayReason?: { readonly en: string; readonly [locale: string]: string }
    signal?: AbortSignal
  }): Promise<MapWriteOutcome>
}

/** 工具层手上有的审批材料。本模块只负责判断，不负责获取。 */
export interface MapWriteApproval<A = object, C = string> {
  /** `ctx.get('approval')`，没有就传 `undefined` (会 fail-closed) 。*/
  approver: MapWriteApprover<A, C> | undefined
  /** 发起调用的 agent；无 agent 的执行传 `undefined`。 */
  agent: A | undefined
  /** 这次工具调用的 id，审批弹窗挂在它上面。 */
  callId: C
  /** 工具名，记进审批审计。 */
  toolName: string
  /** 工具执行的 abort 信号。 */
  signal?: AbortSignal
}

/** 一次地图写入，按本函数看到的样子。 */
export interface MapWriteRequest {
  /** 渲染好的变化正文 (`renderMapChanges` 的产物，语言中立) 。 */
  readonly changes: string
  /** 模型声明的原因。 */
  readonly reason: string
}

/**
 * 在写入地图之前，向人索取一次性授权。
 * @param request - 要批准的变化与原因。
 * @param approval - 工具层持有的审批材料。
 * @returns 批准后 resolve (仅 `allowed-once`) 。
 * @throws 其余三种结局、缺审批服务、缺 agent 时一律抛，且文案各自不同。
 */
export async function approveMapWrite<A, C>(
  request: MapWriteRequest,
  approval: MapWriteApproval<A, C>,
): Promise<void> {
  if (approval.approver === undefined) {
    throw new Error('memory archive: changing the map requires approval, but no approval service is composed')
  }
  if (approval.agent === undefined) {
    throw new Error('memory archive: changing the map requires approval, but the call has no agent to route it through')
  }

  const outcome = await approval.approver.request({
    agent: approval.agent,
    toolName: approval.toolName,
    callId: approval.callId,
    reason: `edit the archive map: ${request.reason}\n\n${request.changes}`,
    displayReason: {
      en: `Change the archive map — ${request.reason}\n\n${request.changes}`,
      zh: `修改档案地图 —— ${request.reason}\n\n${request.changes}`,
    },
    ...approval.signal === undefined ? {} : { signal: approval.signal },
  })

  switch (outcome) {
    case 'allowed-once': return
    case 'rejected':
      throw new Error('memory archive: the user rejected this map change; do not retry it and do not look for another way to write the map — explain what you wanted to change and stop')
    case 'cancelled':
      throw new Error('memory archive: the map-change approval was cancelled')
    case 'unavailable':
      throw new Error('memory archive: this map change needs approval, but no approval channel is available')
    default: {
      const unknown: never = outcome
      throw new Error(`memory archive: unexpected approval outcome ${String(unknown)}`)
    }
  }
}
