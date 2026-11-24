import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DIRECTORY } from '../src/data.ts';
import type { Snapshot } from '../src/data.ts';
import { importCalendar } from '../src/import-calendar.ts';
import { mergeSnapshots } from '../src/storage.ts';

const [personId, file, first, last] = process.argv.slice(2);
const person = DIRECTORY.find((entry) => entry.id === personId);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
if (!person || !file || !datePattern.test(first ?? '') || !datePattern.test(last ?? '') || last < first) {
  throw new Error('Usage: npm run snapshot -- <verified person ID> <official ICS file> <first day YYYY-MM-DD> <last day YYYY-MM-DD>');
}

const contents = readFileSync(file, 'utf8');
if (!/^PRODID:https:\/\/(?:ro-)?rasp\.tpu\.ru\s*$/m.test(contents)) {
  throw new Error('Expected a calendar exported by TPU.');
}
const stamp = contents.match(/^DTSTAMP:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\s*$/m);
if (!stamp) throw new Error('Expected an official export timestamp.');
const [, year, month, day, hours, minutes, seconds] = stamp;
const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`);
const snapshot = importCalendar(contents, person, date);
if (snapshot.lessons.some((lesson) => lesson.date < first || lesson.date > last)) {
  throw new Error('The export contains lessons outside the declared coverage.');
}
snapshot.coverage = { first, last };
snapshot.source = 'tpu';

mkdirSync('public/data', { recursive: true });
const path = 'public/data/snapshots.json';
let existing: Snapshot[] = [];
try {
  existing = JSON.parse(readFileSync(path, 'utf8')).snapshots;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const snapshots = mergeSnapshots(existing, [snapshot]);
writeFileSync(path, `${JSON.stringify({ version: 1, snapshots }, null, 2)}\n`);
console.log(`Published ${snapshot.lessons.length} lessons for ${person.name} (${first} - ${last}).`);
