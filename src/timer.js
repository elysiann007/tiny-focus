import { setTimeout as sleep } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { minutes } from './journal.js';

export async function runTimer(duration, { signal, onTick = () => {}, now = () => performance.now(), wait = sleep } = {}) {
  const deadline = now() + minutes(duration) * 60_000;
  signal?.throwIfAborted();
  while (now() < deadline) {
    signal?.throwIfAborted();
    const remaining = Math.max(1, deadline - now());
    onTick(Math.ceil(remaining / 1000));
    await wait(Math.min(1000, remaining), undefined, { signal });
  }
  signal?.throwIfAborted();
}
