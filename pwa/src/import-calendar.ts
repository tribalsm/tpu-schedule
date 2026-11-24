import ICAL from 'ical.js';
import { addDays, startOfWeek, tomskNow } from './calendar.ts';
import { sortLessons, type Lesson, type Person, type Snapshot } from './data.ts';

const types: Record<string, string> = {
  'лк': 'Лекция', 'лекция': 'Лекция',
  'пр': 'Практика', 'практика': 'Практика',
  'лб': 'Лабораторная', 'лабораторная': 'Лабораторная', 'лабораторная работа': 'Лабораторная',
};
const suffix = /\s*\((лекция|практика|лабораторная(?: работа)?|лк|пр|лб)\)\s*$/i;
const groupList = /^\d[\p{L}\d-]+(?:\s*,\s*\d[\p{L}\d-]+)*$/u;
const teacherList = /^\p{Lu}[\p{L}-]+\s+(?:\p{Lu}\.\s*){1,3}(?:,\s*\p{Lu}[\p{L}-]+\s+(?:\p{Lu}\.\s*){1,3})*$/u;

function calendarTime(time: ICAL.Time) {
  if (time.zone.tzid !== 'floating') return tomskNow(time.toJSDate());
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${time.year}-${pad(time.month)}-${pad(time.day)}`,
    time: `${pad(time.hour)}:${pad(time.minute)}`,
  };
}

export function importCalendar(contents: string, person: Person, now = new Date()): Snapshot {
  const calendar = new ICAL.Component(ICAL.parse(contents));
  if (calendar.name !== 'vcalendar') throw new Error('Выберите файл календаря в формате .ics.');
  const components = calendar.getAllSubcomponents('vevent');
  const events = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Component[] = [];
  for (const component of components) {
    if (component.hasProperty('recurrence-id')) exceptions.push(component);
    else events.set(component.getFirstPropertyValue('uid') as string, new ICAL.Event(component));
  }
  for (const component of exceptions) {
    const change = new ICAL.Event(component);
    events.get(change.uid)?.relateException(change);
  }

  // Recurring calendars without an end date are expanded through the next academic year.
  const today = tomskNow(now).date;
  const firstAllowed = addDays(today, -370);
  const lastAllowed = addDays(today, 740);
  const all: Lesson[] = [];
  for (const event of events.values()) {
    if (!event.startDate) continue;
    const append = (start: ICAL.Time, end: ICAL.Time, item: ICAL.Event) => {
      if (start.isDate || !end || item.component.getFirstPropertyValue('status') === 'CANCELLED') return;
      const begins = calendarTime(start);
      const ends = calendarTime(end);
      if (begins.date !== ends.date || ends.time <= begins.time || !item.summary?.trim()) return;

      const fields = (item.description ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const getField = (pattern: RegExp) => fields.map((line) => line.match(pattern)?.[1]).find(Boolean);
      const split = (value?: string) => value?.split(/[,;]/).map((name) => name.trim()).filter(Boolean);
      const rawType = getField(/^(?:тип(?: занятия)?|вид занятия)\s*[:=-]\s*(.+)$/i)
        ?? item.summary.match(suffix)?.[1]
        ?? fields[0]?.match(suffix)?.[1];
      const location = item.location?.trim();
      const place = location?.match(/^к\.\s*(.+?),\s*ауд\.\s*(.+)$/i);
      all.push({
        id: `${item.uid}:${begins.date}T${begins.time}`,
        title: item.summary.replace(suffix, '').trim(),
        date: begins.date,
        start: begins.time,
        end: ends.time,
        type: rawType && (types[rawType.toLocaleLowerCase('ru')] ?? rawType),
        teachers: split(getField(/^преподавател[ьи]\s*[:=-]\s*(.+)$/i) ?? fields.find((line) => teacherList.test(line))),
        groups: split(getField(/^групп[аы]\s*[:=-]\s*(.+)$/i) ?? fields.find((line) => groupList.test(line))),
        building: place?.[1],
        room: place?.[2],
        location: place ? undefined : location,
      });
    };

    if (event.isRecurring()) {
      const iterator = event.iterator();
      for (let index = 0; index < 12_000; index++) {
        const occurrence = iterator.next();
        if (!occurrence) break;
        const date = calendarTime(occurrence).date;
        if (date > lastAllowed) break;
        if (date < firstAllowed) continue;
        const details = event.getOccurrenceDetails(occurrence);
        append(details.startDate, details.endDate, details.item);
      }
    } else {
      append(event.startDate, event.endDate, event);
    }
  }

  const lessons = sortLessons([...new Map(all.map((lesson) => [lesson.id, lesson])).values()]);
  if (!lessons.length) throw new Error('В файле нет занятий с указанными датой, временем и названием.');
  return {
    person,
    updatedAt: now.toISOString(),
    coverage: {
      first: startOfWeek(lessons[0].date),
      last: addDays(startOfWeek(lessons[lessons.length - 1].date), 6),
    },
    lessons,
    source: 'ical',
  };
}
