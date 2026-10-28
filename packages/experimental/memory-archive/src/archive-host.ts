/** 跑档案的这台机器: 名字由工具自己读，不让模型填。 */

import { hostname } from 'node:os'

/** 字段名。说的是"跑档案馆的那台机器"，不是"你现在拿的设备"。 */
export const HOST_FIELD = '主机'

/**
 * @returns 这台机器的名字，由操作系统给出。
 */
export function readHost(): string {
  return hostname()
}
