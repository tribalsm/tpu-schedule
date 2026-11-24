export type Kind = 'group' | 'teacher';

export interface Person {
  id: string;
  kind: Kind;
  name: string;
  sourceId?: string;
  aliases?: string;
}

export interface Lesson {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  type?: string;
  teachers?: string[];
  groups?: string[];
  room?: string;
  building?: string;
  location?: string;
}

export interface Snapshot {
  person: Person;
  updatedAt: string;
  coverage: { first: string; last: string };
  lessons: Lesson[];
  source: 'tpu' | 'ical';
}

export const DEFAULT_GROUP: Person = { id: 'group:44645', kind: 'group', name: '8К53Т', sourceId: '44645' };
export const EXAMPLE_TEACHER: Person = {
  id: 'teacher:61829', kind: 'teacher',
  name: 'Цапко Сергей Геннадьевич', sourceId: '61829', aliases: 'Цапко С. Г.',
};

export const DIRECTORY: Person[] = [
  DEFAULT_GROUP,
  { id: 'group:44083', kind: 'group', name: '8К51', sourceId: '44083' },
  { id: 'group:44510', kind: 'group', name: '8К51Т', sourceId: '44510' },
  { id: 'group:44511', kind: 'group', name: '8К52Т', sourceId: '44511' },
  { id: 'group:42316', kind: 'group', name: '8И42', sourceId: '42316' },
  EXAMPLE_TEACHER,
  { id: 'teacher:57063', kind: 'teacher', name: 'Ануфриева Т. Н.', sourceId: '57063' },
  { id: 'teacher:59389', kind: 'teacher', name: 'Мирошниченко Е. А.', sourceId: '59389' },
  { id: 'teacher:109784', kind: 'teacher', name: 'Макаровских А. В.', sourceId: '109784' },
  { id: 'teacher:58910', kind: 'teacher', name: 'Чистякова Н. В.', sourceId: '58910' },
  { id: 'teacher:60941', kind: 'teacher', name: 'Склярова Е. А.', sourceId: '60941' },
  { id: 'teacher:521956', kind: 'teacher', name: 'Куртуков Д. А.', sourceId: '521956' },
];

const latinGroupChars: Record<string, string> = {
  a: 'а', b: 'в', e: 'е', k: 'к', m: 'м', h: 'н', o: 'о', p: 'р', c: 'с', t: 'т', y: 'у', x: 'х',
};

export function searchKey(text: string) {
  return text.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\d]+/gu, ' ').trim();
}

function groupKey(text: string) {
  return searchKey(text).replace(/[a-z]/g, (letter) => latinGroupChars[letter] ?? letter).replace(/ /g, '');
}

export function matchesSearch(person: Person, query: string) {
  if (person.kind === 'group') return groupKey(person.name).includes(groupKey(query));
  const name = searchKey(`${person.name} ${person.aliases ?? ''}`);
  return searchKey(query).split(' ').every((word) => name.includes(word));
}

export function findPerson(directory: Person[], kind: Kind, name: string) {
  const key = kind === 'group' ? groupKey : searchKey;
  return directory.find((person) => person.kind === kind
    && (key(person.name) === key(name) || (person.aliases && key(person.aliases) === key(name))));
}

export function lessonPlace(lesson: Lesson) {
  return [lesson.building && `корпус ${lesson.building}`, lesson.room && `ауд. ${lesson.room}`]
    .filter(Boolean).join(', ') || lesson.location;
}

export function lessonStatus(lesson: Lesson, now: { date: string; time: string }) {
  if (lesson.date === now.date && lesson.start <= now.time && now.time < lesson.end) return 'current';
  return `${lesson.date}T${lesson.start}` > `${now.date}T${now.time}` ? 'future' : 'past';
}

export function gaps(lessons: Lesson[]) {
  let previousEnd = '';
  return lessons.flatMap((lesson) => {
    const gap = previousEnd && previousEnd < lesson.start
      ? [{ before: lesson.id, from: previousEnd, to: lesson.start }]
      : [];
    if (lesson.end > previousEnd) previousEnd = lesson.end;
    return gap;
  });
}

export function sortLessons(lessons: Lesson[]) {
  return [...lessons].sort((left, right) =>
    left.date.localeCompare(right.date) || left.start.localeCompare(right.start) || left.title.localeCompare(right.title, 'ru'),
  );
}
