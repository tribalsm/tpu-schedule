import {
  ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Users, WifiOff,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { academicWeek, addDays, dateLabel, startOfWeek, updateLabel, weekRange } from './calendar.ts';
import { findPerson, gaps, lessonPlace, lessonStatus, type Lesson, type Person, type Snapshot } from './data.ts';
import { PersonAvatar } from './PersonAvatar.tsx';

type Clock = { date: string; time: string };

export function OriginalLink({ href, className = 'button secondary' }: { href: string; className?: string }) {
  return <a className={className} href={href} target="_blank" rel="noreferrer">
    Открыть на ТПУ <ArrowUpRight size={16} aria-hidden />
  </a>;
}

export function WeekPicker({ date, today, onChange }: {
  date: string; today: string; onChange: (date: string | null) => void;
}) {
  const currentWeek = startOfWeek(date);
  const academic = academicWeek(date);
  return <section className="week-panel surface" aria-label="Выбор недели и дня">
    <div className="week-heading">
      <div>
        <strong>{weekRange(date)}</strong>
        <span>{academic ? `Учебная неделя ${academic.week}` : 'Календарь ТПУ не подтверждён'}</span>
      </div>
      <div className="week-controls">
        <button className="icon-button" aria-label="Предыдущая неделя" onClick={() => onChange(addDays(date, -7))}>
          <ChevronLeft size={19} aria-hidden />
        </button>
        <button className="button secondary compact" onClick={() => onChange(null)}>Сегодня</button>
        <button className="icon-button" aria-label="Следующая неделя" onClick={() => onChange(addDays(date, 7))}>
          <ChevronRight size={19} aria-hidden />
        </button>
      </div>
    </div>
    <div className="week-days">
      {Array.from({ length: 7 }, (_, index) => {
        const day = addDays(currentWeek, index);
        return <button key={day} className={`day-button ${day === today ? 'today' : ''}`}
          aria-pressed={date === day} aria-label={dateLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}
          onClick={() => onChange(day === today ? null : day)}>
          <span>{dateLabel(day, { weekday: 'short' })}</span>
          <strong>{Number(day.slice(-2))}</strong>
        </button>;
      })}
    </div>
  </section>;
}

export function SnapshotNote({ snapshot, offline }: { snapshot?: Snapshot; offline: boolean }) {
  if (!snapshot && !offline) return null;
  return <p className="snapshot-note">
    {offline ? <WifiOff size={15} aria-hidden /> : <Clock3 size={15} aria-hidden />}
    <span>{offline && 'Офлайн. '}
      {snapshot && `${snapshot.source === 'tpu' ? 'Выгрузка ТПУ' : 'Импортировано'} ${updateLabel(snapshot.updatedAt)} (Томск)`}
      {offline && !snapshot && 'Сохранённого расписания пока нет.'}
    </span>
  </p>;
}

export function EmptyState({ title, text, actions }: { title: string; text: string; actions?: ReactNode }) {
  return <div className="empty-state">
    <div className="empty-icon"><CalendarDays size={22} aria-hidden /></div>
    <h3>{title}</h3>
    <p>{text}</p>
    {actions && <div className="action-row">{actions}</div>}
  </div>;
}

function typeClass(type?: string) {
  return type === 'Лекция' ? 'lecture' : type === 'Лабораторная' ? 'lab' : 'practice';
}

export function LessonList({ lessons, clock, nextId, teacherMode = false, directory, onTeacher, onGroup }: {
  lessons: Lesson[]; clock: Clock; nextId?: string; teacherMode?: boolean; directory: Person[];
  onTeacher: (person: Person) => void; onGroup: (person: Person) => void;
}) {
  const breaks = teacherMode ? gaps(lessons) : [];
  return <ul className="timeline">
    {lessons.map((lesson) => {
      const status = lessonStatus(lesson, clock);
      const place = lessonPlace(lesson);
      const gap = breaks.find((item) => item.before === lesson.id);
      return <li key={lesson.id}>
        {gap && <div className="gap"><Clock3 size={14} aria-hidden /> Промежуток {gap.from} - {gap.to}</div>}
        <article id={`lesson-${lesson.id}`} className={`lesson ${status === 'current' ? 'current-lesson' : ''}`}>
          <div className="lesson-time"><strong>{lesson.start}</strong><span>{lesson.end}</span></div>
          <div className="lesson-body">
            <div className="tag-row">
              {lesson.type && <span className={`tag ${typeClass(lesson.type)}`}>{lesson.type}</span>}
              {status === 'current' && <span className="tag active-tag">Сейчас</span>}
              {lesson.id === nextId && status !== 'current' && <span className="tag next-tag">Следующая</span>}
            </div>
            <h3>{lesson.title}</h3>
            <div className="lesson-details">
              {!teacherMode && lesson.teachers?.length ? <span>
                {lesson.teachers.map((name, index) => {
                  const match = findPerson(directory, 'teacher', name);
                  return <span key={`${name}-${index}`}>{index > 0 && ', '}
                    {match ? <button className="text-button teacher-link" onClick={() => onTeacher(match)}>
                      <PersonAvatar person={match} size="small" /> {name}
                    </button> : name}
                  </span>;
                })}
              </span> : null}
              {teacherMode && lesson.groups?.length ? <span>
                <Users size={15} aria-hidden />
                {lesson.groups.map((name, index) => {
                  const match = findPerson(directory, 'group', name);
                  return <span key={name}>{index > 0 && ', '}
                    {match ? <button className="text-button" onClick={() => onGroup(match)}>{name}</button> : name}
                  </span>;
                })}
              </span> : null}
              {place && <span><MapPin size={15} aria-hidden /> {place}</span>}
            </div>
          </div>
        </article>
      </li>;
    })}
  </ul>;
}
