import type { Person, Snapshot } from './data.ts';

export type Theme = 'system' | 'light' | 'dark';

interface Preferences {
  theme: Theme;
  group?: Person;
  favorites: Person[];
}

const PREFS_KEY = 'tpu-schedule:prefs:1';
const DATA_KEY = 'tpu-schedule:snapshots:1';

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadPreferences() {
  const preferences = read<Preferences | null>(PREFS_KEY, null);
  return {
    theme: ['system', 'light', 'dark'].includes(preferences?.theme ?? '') ? preferences!.theme : 'system',
    group: preferences?.group,
    favorites: Array.isArray(preferences?.favorites) ? preferences!.favorites : [],
  } satisfies Preferences;
}

export const savePreferences = (value: Preferences) => save(PREFS_KEY, value);

export function loadSnapshots() {
  const value = read<Snapshot[]>(DATA_KEY, []);
  return Array.isArray(value) ? value : [];
}

export const saveSnapshots = (value: Snapshot[]) => save(DATA_KEY, value);

export function mergeSnapshots(old: Snapshot[], incoming: Snapshot[]) {
  const snapshots = [...old];
  for (const current of incoming) {
    const index = snapshots.findIndex((snapshot) =>
      snapshot.person.id === current.person.id && snapshot.source === current.source
      && snapshot.coverage.first === current.coverage.first && snapshot.coverage.last === current.coverage.last,
    );
    if (index < 0) snapshots.push(current);
    else if (snapshots[index].updatedAt < current.updatedAt) snapshots[index] = current;
  }
  return snapshots;
}

export function snapshotFor(snapshots: Snapshot[], person: Person, date: string) {
  const candidates = snapshots.filter((item) => item.person.id === person.id);
  const matching = candidates.filter(({ coverage }) => coverage.first <= date && date <= coverage.last);
  return (matching.length ? matching : candidates).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}
