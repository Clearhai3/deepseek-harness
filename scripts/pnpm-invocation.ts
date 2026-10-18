/** Resolve shell-free child-process invocations for the pnpm process that launched a package script. */

/**
 * Resolve pnpm's executable and arguments from its lifecycle environment.
 * @param args - Arguments to pass to pnpm.
 * @param environment - Lifecycle environment containing `npm_execpath`.
 * @returns A command and argument array suitable for `spawn` or `spawnSync` without a shell.
 * @throws When `npm_execpath` is unavailable, or names a `.cmd` shim that cannot start without a shell.
 */
export function pnpmInvocation(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): { command: string; args: string[] } {
  const entrypoint = environment.npm_execpath
  if (entrypoint === undefined || entrypoint === '') {
    throw new Error('pnpm invocation: npm_execpath is unavailable; invoke the script through pnpm run.')
  }
  if (/\.[cm]?js$/iu.test(entrypoint)) {
    return { command: process.execPath, args: [entrypoint, ...args] }
  }
  if (/\.cmd$/iu.test(entrypoint)) {
    throw new Error('pnpm invocation: npm_execpath names a .cmd shim, which cannot start without a shell; run this through pnpm\'s JavaScript entry.')
  }
  return { command: entrypoint, args: [...args] }
}
