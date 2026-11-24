export const TOMSK = 'Asia/Tomsk';
export const PORTAL = 'https://ro-rasp.tpu.ru/';

const DAY = 86_400_000;
const calendars = [{ year: 2026, firstSunday: '2026-08-30', weeks: 51 }];
const tomskClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: TOMSK, calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  hourCycle: 'h23',
});

export function tomskNow(instant = new Date()) {
  const clock = Object.fromEntries(tomskClock.formatToParts(instant).map(({ type, value }) => [type, value]));
  return { date: `${clock.year}-${clock.month}-${clock.day}`, time: `${clock.hour}:${clock.minute}` };
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
}

export function startOfWeek(date: string) {
  return addDays(date, -new Date(date).getUTCDay());
}

export function academicWeek(date: string) {
  for (const calendar of calendars) {
    const week = 1 + Math.floor((Date.parse(date) - Date.parse(calendar.firstSunday)) / (7 * DAY));
    if (week >= 1 && week <= calendar.weeks) return { year: calendar.year, week };
  }
  return null;
}

export function scheduleUrl(entity?: { kind: 'group' | 'teacher'; sourceId?: string }, date?: string) {
  const week = date && academicWeek(date);
  if (!entity?.sourceId || !/^\d+$/.test(entity.sourceId) || !week) {
    return entity?.kind === 'teacher' ? `${PORTAL}site/teacher.html` : PORTAL;
  }
  const prefix = entity.kind === 'group' ? 'gruppa' : 'user';
  return `${PORTAL}${prefix}_${entity.sourceId}/${week.year}/${week.week}/view.html`;
}

export function dateLabel(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: 'UTC' }).format(new Date(date));
}

export function weekRange(date: string) {
  const first = startOfWeek(date);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  }).formatRange(new Date(first), new Date(addDays(first, 6))).replace(/[–—]/g, '-');
}

export function updateLabel(date: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TOMSK, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}
