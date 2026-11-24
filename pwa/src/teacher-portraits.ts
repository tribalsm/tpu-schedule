import { searchKey, type Person } from './data.ts';

export const TPU_STAFF_DIRECTORY = 'https://staff.tpu.ru/personal';

// Each image URL comes from the corresponding public TPU employee profile.
const portraits: Record<string, string> = {
  '57063': 'https://img.tpu.ru/foto/57000/MTkxNzBkXzU3MDYzXzBfMTIwXzE0MF9f.jpg',
  '57572': 'https://img.tpu.ru/foto/57000/ODc3YmUzXzU3NTcyXzBfMTIwXzE0MF9f.jpg',
  '58910': 'https://img.tpu.ru/foto/58000/YjYyMThmXzU4OTEwXzBfMTIwXzE0MF9f.jpg',
  '59389': 'https://img.tpu.ru/foto/59000/ZjY0ZGQyXzU5Mzg5XzBfMTIwXzE0MF9f.jpg',
  '60941': 'https://img.tpu.ru/foto/60000/YmQ5OWE3XzYwOTQxXzBfMTIwXzE0MF9f.jpg',
  '61382': 'https://img.tpu.ru/foto/61000/YWUxZDRiXzYxMzgyXzBfMTIwXzE0MF9f.jpg',
  '61829': 'https://img.tpu.ru/foto/61000/YmFjMzUzXzYxODI5XzBfMTIwXzE0MF9f.jpg',
  '109784': 'https://img.tpu.ru/foto/109000/YmE0NjQ5XzEwOTc4NF8wXzEyMF8xNDBf.jpg',
  '205696': 'https://img.tpu.ru/foto/205000/Y2U2NGQyXzIwNTY5Nl8wXzEyMF8xNDBf.jpg',
};

// These verified names also appear in calendar imports without an employee ID.
const staffIdsByName: Record<string, string> = {
  'боброва м в': '205696',
  'боброва маргарита владимировна': '205696',
  'ефремова о н': '57572',
  'ефремова оксана николаевна': '57572',
  'титаренко е ю': '61382',
  'титаренко екатерина юрьевна': '61382',
};

export function teacherPortrait(person: Person) {
  if (person.kind !== 'teacher') return;
  const id = person.sourceId ?? staffIdsByName[searchKey(person.name)];
  const url = portraits[id];
  if (url) return { url, profile: `${TPU_STAFF_DIRECTORY}/employee?lid=${id}` };
}
