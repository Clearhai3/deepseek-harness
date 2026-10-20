/** Electron-builder writes app-update.yml only for release targets; other builds update through their package manager. */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/**
 * @param resourcesPath - Packaged resources directory that may hold the generated feed description.
 * @returns Whether this build ships an update feed it can check.
 */
export function hasPackagedUpdateSource(resourcesPath: string = process.resourcesPath): boolean {
  return app.isPackaged && existsSync(join(resourcesPath, 'app-update.yml'))
}
