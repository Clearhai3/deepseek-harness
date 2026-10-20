import { describe, expect, it } from 'vitest'

const IDENTITY = {
  DSH_DESKTOP_APP_ID: 'com.example.harness',
  DSH_DESKTOP_UNSIGNED: '1',
}

async function linuxConfig(environment: Record<string, string> = {}) {
  const { createElectronBuilderConfig } = await import('../scripts/electron-builder-config.mjs')
  return createElectronBuilderConfig({ ...IDENTITY, ...environment }, 'linux', 'x64')
}

describe('Linux .deb packaging', () => {
  it('builds a deb without the update policy a Linux build cannot enforce', async () => {
    const config = await linuxConfig()
    expect(config.linux).toMatchObject({ target: ['deb'], executableName: 'deepseek-harness' })
    expect(config.deb).toEqual({ packageName: 'deepseek-harness' })
    expect(config.extraMetadata).not.toHaveProperty('dshMandatoryUpdatePolicy')
  })

  it('defaults the maintainer so a fork never publishes the builder identity', async () => {
    expect((await linuxConfig()).linux.maintainer).toBe('DeepSeek Harness <noreply@deepseek.invalid>')
  })

  it('takes the maintainer from the environment when set', async () => {
    const config = await linuxConfig({ DSH_DESKTOP_DEB_MAINTAINER: 'Fork <fork@example.com>' })
    expect(config.linux.maintainer).toBe('Fork <fork@example.com>')
  })
})
