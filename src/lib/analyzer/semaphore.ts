import { StackflyError } from '@/lib/errors';

/**
 * Limita quantas análises rodam ao mesmo tempo nesta instância. Com Fluid
 * Compute a Vercel manda várias requisições para a mesma instância, e cada
 * página aberta no Chromium consome centenas de MB.
 */
export class Semaphore {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(timeoutMs: number): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
      return this.releaser();
    }
    return new Promise((resolve, reject) => {
      const grant = () => {
        clearTimeout(timer);
        this.active++;
        resolve(this.releaser());
      };
      const timer = setTimeout(() => {
        this.queue = this.queue.filter((g) => g !== grant);
        reject(new StackflyError('SERVER_BUSY', 'Muitas análises em andamento. Tente novamente em instantes.'));
      }, timeoutMs);
      this.queue.push(grant);
    });
  }

  private releaser() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      this.queue.shift()?.();
    };
  }
}
