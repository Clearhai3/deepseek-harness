/** 出厂模板: 该包内自带的 markdown, 交给 archive_init 落盘。 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** 包内自带的模板目录; 打包后从 `lib/` 往上找 `assets/`。 */
const TEMPLATES = new URL('../assets/templates/', import.meta.url)

/**
 * @param name - 资产文件名, 如 `AGENTS.md`。
 * @returns 模板原文，占位符原样保留。
 * @throws 资产缺失时 —— 出产件没带上, 宁可大声失败, 也不写出半分骨架。
 */
function load(name: string): string {
  try {
    return readFileSync(fileURLToPath(new URL(name, TEMPLATES)), 'utf8')
  } catch (cause) {
    throw new Error(`memory archive: missing template asset ${name}`, { cause })
  }
}

/**
 * @returns 手册模板: 骨架 + 空实例槽, 含 `{{date}}` 占位符。
 */
export function agentsTemplate(): string {
  return load('AGENTS.md')
}

/**
 * @returns 出厂说明模板: 无占位符，原样落盘。
 */
export function readmeTemplate(): string {
  return load('README.md')
}
