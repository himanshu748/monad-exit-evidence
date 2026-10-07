import type { ChildProcess } from 'node:child_process';

/** Own only this supervisor's resources; never stop another process or delete state. */
export class SupervisorLifecycle {
  readonly controller = new AbortController();
  exitCode = 0;
  private cleanups: { name: string; close: () => Promise<unknown> | unknown }[] = [];
  private closing?: Promise<void>;
  private closed = false;
  private readonly report: (name: string) => void;
  private readonly cleanupDeadlineMs: number;

  constructor(report: (name: string) => void = () => {}, cleanupDeadlineMs = 10_000) {
    this.report = report;
    this.cleanupDeadlineMs = cleanupDeadlineMs;
  }

  get running() { return !this.controller.signal.aborted; }
  requestStop(failed = false) {
    if (failed) this.exitCode = 1;
    this.controller.abort();
  }
  own(name: string, close: () => Promise<unknown> | unknown) {
    if (this.closed) throw new Error('Supervisor cleanup has already started');
    this.cleanups.push({ name, close });
  }
  wait(milliseconds: number): Promise<void> {
    return new Promise(resolve => {
      if (!this.running) return resolve();
      const finish = () => {
        clearTimeout(timer);
        this.controller.signal.removeEventListener('abort', finish);
        resolve();
      };
      const timer = setTimeout(finish, milliseconds);
      this.controller.signal.addEventListener('abort', finish, { once: true });
    });
  }
  close(): Promise<void> {
    this.requestStop();
    this.closed = true;
    return this.closing ??= this.closeOwned();
  }
  private async closeOwned() {
    for (const { name, close } of this.cleanups.toReversed()) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.resolve().then(close),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cleanup deadline')), this.cleanupDeadlineMs); }),
        ]);
      } catch {
        this.exitCode = 1;
        this.report(name);
      } finally { if (timer) clearTimeout(timer); }
    }
  }
}

/** Bound an owned child's shutdown, including children that ignore SIGTERM. */
export async function stopOwnedChild(child: ChildProcess, graceMs = 5_000): Promise<void> {
  if (!child.pid) return;
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  if (exited() && child.stdio.every(stream => stream == null || stream.closed)) return;
  await new Promise<void>((resolve, reject) => {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const finish = () => { clearTimeout(grace); if (deadline) clearTimeout(deadline); resolve(); };
    child.once('close', finish);
    const grace = setTimeout(() => {
      if (!exited()) child.kill('SIGKILL');
      deadline = setTimeout(() => { child.removeListener('close', finish); reject(new Error('Owned child did not close')); }, graceMs);
    }, graceMs);
    if (!exited()) child.kill('SIGTERM');
  });
}

/** Cleanup deadlines also bound process lifetime when an owned handle cannot close. */
export function exitAfterCleanup(code: number, milliseconds = 2_000) {
  setTimeout(() => process.exit(code), milliseconds).unref();
}

/** Public-RPC indexing needs no HyperSync credential, even in an operator shell. */
export function publicRpcChildEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const child = { ...environment };
  delete child.ENVIO_API_TOKEN;
  return child;
}

/** Startup failures and normal stops use the same cleanup path. */
export async function withSupervisor(work: (lifecycle: SupervisorLifecycle) => Promise<void>, report: (name: string) => void = () => {}) {
  const lifecycle = new SupervisorLifecycle(report);
  try { await work(lifecycle); }
  catch (error) { lifecycle.requestStop(true); throw error; }
  finally { await lifecycle.close(); }
  return lifecycle.exitCode;
}
