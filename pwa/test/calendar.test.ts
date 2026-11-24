import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { academicWeek, scheduleUrl, tomskNow } from '../src/calendar.ts';
import { DEFAULT_GROUP, EXAMPLE_TEACHER, matchesSearch, type Snapshot } from '../src/data.ts';
import { importCalendar } from '../src/import-calendar.ts';

test('weeks advance at Tomsk midnight on Sunday and retain the academic year in January', () => {
  for (const [instant, week] of [
    ['2026-11-21T16:59:59.999Z', 12], ['2026-11-21T17:00:00Z', 13],
    ['2026-11-28T16:59:59.999Z', 13], ['2026-11-28T17:00:00Z', 14],
    ['2026-12-05T16:59:59.999Z', 14], ['2026-12-05T17:00:00Z', 15],
    ['2026-12-31T17:00:00Z', 18], ['2027-01-02T17:00:00Z', 19],
    ['2027-02-06T17:00:00Z', 24],
    ['2027-08-21T16:59:59.999Z', 51],
  ] as const) {
    assert.deepEqual(academicWeek(tomskNow(new Date(instant)).date), { year: 2026, week });
  }
  assert.equal(academicWeek(tomskNow(new Date('2027-08-21T17:00:00Z')).date), null);
  assert.equal(scheduleUrl(DEFAULT_GROUP, '2027-09-01'), 'https://ro-rasp.tpu.ru/');
  assert.equal(scheduleUrl(DEFAULT_GROUP, '2027-01-04'), 'https://ro-rasp.tpu.ru/gruppa_44645/2026/19/view.html');
});

test('public snapshots contain the same real group and teacher lecture', () => {
  const { snapshots } = JSON.parse(readFileSync(new URL('../public/data/snapshots.json', import.meta.url), 'utf8')) as { snapshots: Snapshot[] };
  for (const person of [DEFAULT_GROUP, EXAMPLE_TEACHER]) {
    const data = snapshots.find((snapshot) => snapshot.person.id === person.id);
    assert.ok(data && data.lessons.length > 30);
    const event = data.lessons.find((lesson) => lesson.date === '2026-11-24' && lesson.start === '08:30');
    assert.equal(event?.title, 'ОС');
    assert.equal(event?.type, 'Лекция');
    assert.equal(event?.end, '10:05');
    assert.equal(event?.building, '10');
    assert.equal(event?.room, '213');
    assert.ok(event?.teachers?.includes('Цапко С. Г.'));
    assert.ok(event?.groups?.includes('8К53Т'));
  }
});

test('directory finds the verified teacher and group with mixed keyboard layout', () => {
  assert.ok(matchesSearch(EXAMPLE_TEACHER, 'цапко сергей'));
  assert.ok(matchesSearch(DEFAULT_GROUP, '8k53t'));
  assert.ok(!matchesSearch(DEFAULT_GROUP, '9k53t'));
});

test('iCal import reads UTC and floating times and handles recurring exceptions', () => {
  const data = importCalendar([
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:example-test',
    'DTSTART:20261124T013000Z', 'DTEND:20261124T030500Z', 'SUMMARY:Контроль импорта (ЛК)',
    'RRULE:FREQ=WEEKLY;COUNT=3', 'EXDATE:20261201T013000Z', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:floating-test', 'DTSTART:20261124T102500', 'DTEND:20261124T120000',
    'SUMMARY:Контроль локального времени', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n'), DEFAULT_GROUP, new Date('2026-11-24T13:00:00Z'));
  assert.deepEqual(data.lessons.map(({ date, start }) => [date, start]), [
    ['2026-11-24', '08:30'], ['2026-11-24', '10:25'], ['2026-12-08', '08:30'],
  ]);
  assert.throws(() => importCalendar('broken file', DEFAULT_GROUP));
});
