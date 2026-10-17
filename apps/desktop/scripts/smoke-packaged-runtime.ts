/** Validate the assembled application, including native Office conversion outside ASAR. */
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { desktopArtifactOutput, resolveDesktopBuildTarget, resolveDesktopTargetBuildPaths, type DesktopBuildTarget } from './desktop-build-paths.mjs'
import { readDesktopRuntime, verifyDesktopRuntime } from '../src/runtime-tree.ts'
import { verifyWindowsCode } from './windows-runtime-signature.mjs'
import { smokePreparedRuntime } from './smoke-prepared-runtime.ts'
import { resolveDesktopPackageTarget } from './package-target.ts'

const paths = resolveDesktopTargetBuildPaths()
const { values } = parseArgs({ options: { unsigned: { type: 'boolean', default: false }, 'skip-notarization': { type: 'boolean', default: false } }, allowPositionals: false })
const target = resolveDesktopBuildTarget()
const windows = target === 'win-x64'
const artifacts = desktopArtifactOutput(paths, { unsigned: values.unsigned, skipNotarization: values['skip-notarization'] }).directory
function artifactLayout(artifacts: string, target: DesktopBuildTarget) {
  if (target === 'win-x64') {
    const application = join(artifacts, 'win-unpacked')
    return { application, resources: join(application, 'resources'), executable: join(application, 'DeepSeek Harness.exe') }
  }
  if (target === 'linux-x64') {
    const application = join(artifacts, 'linux-unpacked')
    const { name } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string }
    return { application, resources: join(application, 'resources'), executable: join(application, name.replaceAll('/', '')) }
  }
  const application = join(artifacts, target === 'mac-arm64' ? 'mac-arm64' : 'mac', 'DeepSeek Harness.app', 'Contents')
  return { application, resources: join(application, 'Resources'), executable: join(application, 'MacOS', 'DeepSeek Harness') }
}
const { application, resources, executable } = artifactLayout(artifacts, target)
const descriptor = await verifyDesktopRuntime(paths.dsh, readDesktopRuntime(paths.dsh).release.version,
  resolveDesktopPackageTarget(target))
if (windows && !values.unsigned) await verifyWindowsCode(application)
await smokePreparedRuntime(join(resources, 'app.asar', 'dsh'), executable, join(resources, 'runtime'), descriptor)
