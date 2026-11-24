import type { Snapshot } from './data.ts';

export async function fetchPublished(signal: AbortSignal) {
  const url = new URL('./data/snapshots.json', location.href);
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json() as { version: number; snapshots: Snapshot[] };
  if (data.version !== 1 || !Array.isArray(data.snapshots)) throw new Error('Неизвестный формат расписания.');
  return data.snapshots;
}
