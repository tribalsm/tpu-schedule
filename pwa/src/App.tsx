import {
  ArrowDownToLine, ArrowUpRight, CalendarDays, ChevronRight, Clock3, FileUp, House, MapPin,
  Search, Settings2, Star, Users, Wifi, WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { academicWeek, addDays, dateLabel, PORTAL, scheduleUrl, startOfWeek, tomskNow, weekRange } from './calendar.ts';
import {
  DEFAULT_GROUP, DIRECTORY, EXAMPLE_TEACHER, findPerson, lessonPlace, lessonStatus,
  matchesSearch, searchKey, type Lesson, type Person, type Snapshot,
} from './data.ts';
import { ImportDialog } from './ImportDialog.tsx';
import { fetchPublished } from './published.ts';
import { isStandalone, promptInstall, registerServiceWorker } from './pwa.ts';
import { EmptyState, LessonList, OriginalLink, SnapshotNote, WeekPicker } from './Schedule.tsx';
import { loadPreferences, loadSnapshots, mergeSnapshots, savePreferences, saveSnapshots, snapshotFor, type Theme } from './storage.ts';

type Page = 'home' | 'schedule' | 'people' | 'settings';
type Route = { page: Page; teacherId?: string };

const pages = [
  { id: 'home', label: 'Главная', icon: House },
  { id: 'schedule', label: 'Расписание', icon: CalendarDays },
  { id: 'people', label: 'Поиск', icon: Search },
  { id: 'settings', label: 'Настройки', icon: Settings2 },
] as const;

function getRoute(): Route {
  const hash = location.hash.slice(1);
  if (hash.startsWith('teacher=')) {
    try {
      return { page: 'people', teacherId: decodeURIComponent(hash.slice(8)) };
    } catch {
      return { page: 'people' };
    }
  }
  return { page: pages.find((page) => page.id === hash)?.id ?? 'home' };
}

function useTomskClock() {
  const [clock, setClock] = useState(tomskNow);
  useEffect(() => {
    let timer: number;
    const tick = () => {
      window.clearTimeout(timer);
      setClock(tomskNow());
      timer = window.setTimeout(tick, 60_000 - Date.now() % 60_000);
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, []);
  return clock;
}

const dayHeading = (date: string) => dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' });

function countLessons(count: number) {
  const word = new Intl.PluralRules('ru').select(count);
  return `${count} ${word === 'one' ? 'занятие' : word === 'few' ? 'занятия' : 'занятий'}`;
}

export function App() {
  const [prefs, setPrefs] = useState(loadPreferences);
  const [snapshots, setSnapshots] = useState(loadSnapshots);
  const [route, setRoute] = useState(getRoute);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [weekView, setWeekView] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'teacher' | 'group'>('all');
  const [importOpen, setImportOpen] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [source, setSource] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState('');
  const group = prefs.group ?? DEFAULT_GROUP;
  const clock = useTomskClock();
  const day = selectedDay ?? clock.date;
  const week = academicWeek(day);
  const weekStart = startOfWeek(day);
  const weekEnd = addDays(weekStart, 6);

  const directory = useMemo(() => {
    const known = new Map<string, Person>();
    for (const person of [...DIRECTORY, ...snapshots.map((item) => item.person), ...prefs.favorites, group]) {
      known.set(person.id, person);
    }
    for (const { lessons } of snapshots) {
      for (const lesson of lessons) {
        for (const [kind, names] of [['teacher', lesson.teachers], ['group', lesson.groups]] as const) {
          for (const name of names ?? []) {
            const id = `${kind}:local:${searchKey(name)}`;
            if (!findPerson([...known.values()], kind, name)) known.set(id, { id, name, kind });
          }
        }
      }
    }
    return [...known.values()];
  }, [snapshots, prefs.favorites, group]);

  const teacher = directory.find((person) => person.id === route.teacherId && person.kind === 'teacher');
  const person = teacher ?? group;
  const currentSnapshot = snapshotFor(snapshots, person, day);
  const hasWeekCoverage = snapshots.some((item) => item.person.id === person.id
    && item.coverage.first <= weekEnd && item.coverage.last >= weekStart);
  const homeSnapshot = snapshotFor(snapshots, group, clock.date);
  const todayLessons = homeSnapshot?.lessons.filter((lesson) => lesson.date === clock.date) ?? [];
  const next = homeSnapshot?.lessons.find((lesson) => lessonStatus(lesson, clock) === 'future');
  const ongoing = todayLessons.find((lesson) => lessonStatus(lesson, clock) === 'current');
  const heroLesson = ongoing ?? next;
  const activeLesson = currentSnapshot?.lessons.find((lesson) => lessonStatus(lesson, clock) === 'current');
  const upcomingLesson = currentSnapshot?.lessons.find((lesson) => lessonStatus(lesson, clock) === 'future');
  const currentHref = scheduleUrl(person, day);
  const favorites = prefs.favorites;

  useEffect(() => {
    const apply = () => setRoute(getRoute());
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    savePreferences(prefs);
  }, [prefs]);

  useEffect(() => {
    registerServiceWorker().catch(() => setNotice('Офлайн-запуск недоступен в этом браузере.'));
  }, []);

  useEffect(() => {
    if (!online) return;
    const request = new AbortController();
    const timeout = window.setTimeout(() => request.abort('timeout'), 7000);
    fetchPublished(request.signal).then((items) => {
      if (request.signal.aborted) return;
      setSnapshots((existing) => {
        const merged = mergeSnapshots(existing, items);
        saveSnapshots(merged);
        return merged;
      });
      setSource('ready');
    }).catch(() => {
      if (request.signal.reason !== 'cleanup') setSource('error');
    }).finally(() => window.clearTimeout(timeout));
    return () => {
      request.abort('cleanup');
      window.clearTimeout(timeout);
    };
  }, [online, refresh]);

  function navigate(page: Page, teacherId?: string) {
    const hash = teacherId ? `teacher=${encodeURIComponent(teacherId)}` : page;
    if (location.hash !== `#${hash}`) location.hash = hash;
    setRoute({ page, teacherId });
    window.scrollTo(0, 0);
  }

  function selectGroup(selected: Person) {
    setPrefs((previous) => ({ ...previous, group: selected }));
    setSelectedDay(null);
    navigate('schedule');
  }

  function showTeacher(selected: Person) {
    setSelectedDay(null);
    navigate('people', selected.id);
  }

  function openGroupSearch() {
    setQuery('');
    setFilter('group');
    navigate('people');
  }

  function toggleFavorite(selected: Person) {
    setPrefs((previous) => ({
      ...previous,
      favorites: previous.favorites.some((item) => item.id === selected.id)
        ? previous.favorites.filter((item) => item.id !== selected.id)
        : [...previous.favorites, selected],
    }));
  }

  function saveImport(snapshot: Snapshot) {
    const merged = mergeSnapshots(snapshots, [snapshot]);
    const saved = saveSnapshots(merged);
    setSnapshots(merged);
    setImportOpen(false);
    setNotice(saved ? `Импортировано ${countLessons(snapshot.lessons.length)}.`
      : 'Расписание открыто. Хранилище браузера заполнено или недоступно.');
    if (snapshot.person.kind === 'group') selectGroup(snapshot.person);
    else showTeacher(snapshot.person);
    if (clock.date < snapshot.coverage.first || clock.date > snapshot.coverage.last) {
      setSelectedDay(snapshot.lessons[0].date);
    }
  }

  function jumpToLesson(lesson: Lesson) {
    setSelectedDay(lesson.date === clock.date ? null : lesson.date);
    if (route.page === 'home') navigate('schedule');
    window.requestAnimationFrame(() => document.getElementById(`lesson-${lesson.id}`)?.scrollIntoView({ block: 'center' }));
  }

  function showToday() {
    setSelectedDay(null);
    setWeekView(false);
    navigate('schedule');
  }

  function reloadPublished() {
    setSource('loading');
    setRefresh((current) => current + 1);
  }

  async function install() {
    try {
      if (!(await promptInstall())) setInstallHelp((visible) => !visible);
    } catch {
      setInstallHelp(true);
    }
  }

  function favoriteButton(selected: Person) {
    const favorite = favorites.some((item) => item.id === selected.id);
    return <button className={`icon-button star-button ${favorite ? 'is-favorite' : ''}`}
      aria-label={favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
      aria-pressed={favorite} onClick={() => toggleFavorite(selected)}>
      <Star size={19} aria-hidden />
    </button>;
  }

  function unavailable(snapshot?: Snapshot, selected = person) {
    if (source === 'loading' && online && !snapshot) {
      return <div className="loading-state" role="status">Загружаем расписание…</div>;
    }
    return <EmptyState title={snapshot ? 'За этот период нет выгрузки' : 'Расписание ещё не загружено'}
      text={snapshot ? 'Можно открыть последний доступный период или загрузить новый файл .ics.'
        : online ? 'Откройте актуальное расписание ТПУ или импортируйте файл .ics.'
          : 'При отсутствии сети доступно расписание, которое уже было загружено на это устройство.'}
      actions={<>
        {snapshot && <button className="button secondary" onClick={() => setSelectedDay(snapshot.lessons.at(-1)?.date ?? snapshot.coverage.last)}>
          Последняя выгрузка
        </button>}
        <OriginalLink href={scheduleUrl(selected, day)} />
      </>} />;
  }

  function renderDay(date: string, snapshot?: Snapshot) {
    const covered = snapshot && snapshot.coverage.first <= date && date <= snapshot.coverage.last;
    if (!covered) return unavailable(snapshot);
    const lessons = snapshot.lessons.filter((lesson) => lesson.date === date);
    if (!lessons.length) return <EmptyState title="Занятий нет" text="В загруженном расписании на этот день нет занятий." />;
    return <LessonList lessons={lessons} clock={clock} nextId={upcomingLesson?.id} teacherMode={Boolean(teacher)}
      directory={directory} onTeacher={showTeacher} onGroup={selectGroup} />;
  }

  const filtered = directory.filter((entry) => (filter === 'all' || entry.kind === filter) && matchesSearch(entry, query));
  const heading = route.page === 'home' ? 'Моё расписание'
    : teacher ? teacher.name
      : route.page === 'schedule' ? `Расписание группы ${group.name}`
        : route.page === 'people' ? 'Преподаватели и группы' : 'Настройки';

  return <div className="app-shell">
    <a href="#main-content" className="skip-link" onClick={(event) => {
      event.preventDefault();
      document.getElementById('main-content')?.focus();
    }}>К содержанию</a>
    <aside className="sidebar">
      <a className="brand" href="#home">
        <span className="brand-mark"><img src="./apple-touch-icon.png" alt="" /></span>
        <span><strong>Расписание ТПУ</strong><small>Учебный календарь</small></span>
      </a>
      <nav className="navigation" aria-label="Основное меню">
        {pages.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`}
          aria-current={route.page === id ? 'page' : undefined} onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (id === 'schedule') setSelectedDay(null);
            if (id === 'people') { setFilter('all'); setQuery(''); }
            if (id === 'home') setSelectedDay(null);
            navigate(id);
          }}>
          <Icon size={20} strokeWidth={1.9} aria-hidden /><span>{label}</span>
        </a>)}
      </nav>
      <div className="sidebar-bottom">
        <button className="sidebar-group" onClick={openGroupSearch}>
          <span className="sidebar-group-icon"><Users size={17} aria-hidden /></span>
          <span><small>Моя группа</small><strong>{group.name}</strong></span><ChevronRight size={16} aria-hidden />
        </button>
        <a href={PORTAL} target="_blank" rel="noreferrer" className="sidebar-source">ИПК Расписание ТПУ <ArrowUpRight size={14} aria-hidden /></a>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="topbar-location">
          <span className="mobile-mark"><img src="./apple-touch-icon.png" alt="" /></span>
          <span className="mobile-brand">Расписание ТПУ</span>
          <span className="desktop-title">{pages.find(({ id }) => id === route.page)?.label}</span>
        </div>
        <div className="topbar-actions">
          <span className={`connection ${online ? '' : 'offline'}`}>
            {online ? <Wifi size={16} aria-hidden /> : <WifiOff size={16} aria-hidden />}
            {online ? 'В сети' : 'Офлайн'}
          </span>
          <button className="button secondary top-group" onClick={openGroupSearch}
            aria-label={`Сменить группу, сейчас ${group.name}`}><Users size={17} aria-hidden /> {group.name}</button>
        </div>
      </header>
      <main className="content" id="main-content" tabIndex={-1}>
        <div className="page-title">
          <div>
            {teacher && <button className="text-button breadcrumb" onClick={() => navigate('people')}>Все преподаватели</button>}
            <h1>{heading}</h1>
            {route.page === 'home' && <p>{dayHeading(clock.date)} <span className="header-separator">/</span> Томск</p>}
            {route.page === 'people' && !teacher && <p>Найдите расписание или добавьте преподавателя в избранное.</p>}
            {teacher && <p>Расписание преподавателя</p>}
          </div>
          {route.page === 'home' && <button className="button secondary page-action" onClick={showToday}><CalendarDays size={18} aria-hidden /> Сегодня</button>}
          {route.page === 'schedule' && <OriginalLink href={currentHref} className="button secondary page-action" />}
          {teacher && favoriteButton(teacher)}
        </div>

        {notice && <div className="notice" role="status"><span>{notice}</span><button className="text-button" onClick={() => setNotice('')}>Закрыть</button></div>}

        {route.page === 'home' && <div className="home-grid">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-content">
              <span className="hero-label"><Clock3 size={15} aria-hidden /> {ongoing ? 'Пара сейчас' : 'Ближайшая пара'}</span>
              <h2 id="hero-title">{heroLesson?.title ?? (source === 'loading' && online && !homeSnapshot ? 'Загружаем расписание…' : 'Ближайших пар в выгрузке нет')}</h2>
              {heroLesson ? <>
                <div className="hero-details">
                  <span><CalendarDays size={17} aria-hidden /> {dateLabel(heroLesson.date, { weekday: 'short', day: 'numeric', month: 'short' })}, {heroLesson.start} - {heroLesson.end}</span>
                  {lessonPlace(heroLesson) && <span><MapPin size={17} aria-hidden /> {lessonPlace(heroLesson)}</span>}
                </div>
                <button className="button hero-button" onClick={() => jumpToLesson(heroLesson)}>К занятию <ChevronRight size={17} aria-hidden /></button>
              </> : <OriginalLink href={scheduleUrl(group, clock.date)} className="button hero-button" />}
            </div>
            <div className="hero-calendar" aria-hidden="true">
              <div className="hero-calendar-top"><i /><i /></div>
              <div className="hero-calendar-grid">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
            </div>
          </section>
          <section className="week-summary surface">
            <div className="week-summary-top"><span className="calendar-icon"><CalendarDays size={22} aria-hidden /></span>
              <span>Текущая неделя</span></div>
            <div className="week-summary-number">{academicWeek(clock.date)?.week ?? '-'}</div>
            <p>{weekRange(clock.date)}</p>
            <button className="text-button" onClick={() => {
              setSelectedDay(null);
              setWeekView(true);
              navigate('schedule');
            }}>Расписание недели <ChevronRight size={15} aria-hidden /></button>
          </section>
          <section className="today-panel surface" aria-labelledby="today-title">
            <div className="panel-heading">
              <div><h2 id="today-title">Сегодня</h2><p>{dayHeading(clock.date)}</p></div>
              {todayLessons.length > 0 && <span className="soft-pill">{countLessons(todayLessons.length)}</span>}
            </div>
            {todayLessons.length ? <LessonList lessons={todayLessons} clock={clock} nextId={next?.id}
              directory={directory} onTeacher={showTeacher} onGroup={selectGroup} />
              : renderDay(clock.date, homeSnapshot)}
            <SnapshotNote snapshot={homeSnapshot} offline={!online} />
          </section>
          <div className="home-side">
            <section className="favorites surface">
              <div className="panel-heading"><div><h2>Избранное</h2><p>Преподаватели</p></div><Star size={22} aria-hidden /></div>
              {favorites.length ? <ul className="person-list">{favorites.map((item) => <li key={item.id}>
                <button className="person-open" onClick={() => showTeacher(item)}><strong>{item.name}</strong><ChevronRight size={17} aria-hidden /></button>
              </li>)}</ul> : <p className="side-empty">Добавьте преподавателей, чтобы открывать их расписание с главной.</p>}
              <button className="text-button" onClick={() => { setFilter('teacher'); setQuery(''); navigate('people'); }}>
                <Search size={16} aria-hidden /> Найти преподавателя
              </button>
            </section>
            <section className="source-card surface">
              <FileUp size={20} aria-hidden />
              <div><h2>Свежая выгрузка</h2><p>Добавьте файл .ics с сайта ТПУ.</p></div>
              <button className="text-button" onClick={() => setImportOpen(true)}>Импортировать <ChevronRight size={16} aria-hidden /></button>
            </section>
          </div>
        </div>}

        {(route.page === 'schedule' || teacher) && <>
          <WeekPicker date={day} today={clock.date} onChange={setSelectedDay} />
          <section className="schedule-panel surface" aria-label="Список занятий">
            <div className="panel-heading">
              <div><h2>{weekView ? weekRange(day) : dayHeading(day)}</h2><p>{week ? `Неделя ${week.week}` : 'Учебная неделя не подтверждена'}</p></div>
              <div className="segmented" aria-label="Режим просмотра">
                <button aria-pressed={!weekView} onClick={() => setWeekView(false)}>День</button>
                <button aria-pressed={weekView} onClick={() => setWeekView(true)}>Неделя</button>
              </div>
            </div>
            <div className="schedule-actions">
              {teacher && <OriginalLink href={currentHref} />}
              <button className="button secondary" onClick={() => setImportOpen(true)}><FileUp size={17} aria-hidden /> Импорт .ics</button>
              {teacher && activeLesson && <button className="button primary" onClick={() => jumpToLesson(activeLesson)}>К текущей паре</button>}
              {teacher && !activeLesson && upcomingLesson && <button className="button secondary" onClick={() => jumpToLesson(upcomingLesson)}>К ближайшей паре</button>}
            </div>
            {teacher && <p className="gap-hint">Промежутки между занятиями не подтверждают доступность преподавателя для консультации.</p>}
            {weekView && hasWeekCoverage ? Array.from({ length: 7 }, (_, index) => {
              const date = addDays(weekStart, index);
              const snapshot = snapshotFor(snapshots, person, date);
              return <div className="week-block" key={date}><h3>{dayHeading(date)}</h3>{renderDay(date, snapshot)}</div>;
            }) : weekView ? unavailable(currentSnapshot) : renderDay(day, currentSnapshot)}
            <SnapshotNote snapshot={currentSnapshot} offline={!online} />
          </section>
        </>}

        {route.page === 'people' && !teacher && <section className="directory surface">
          <label className="search-field"><Search size={20} aria-hidden />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
              aria-label="Поиск преподавателей и групп" placeholder="Фамилия, имя или номер группы" />
          </label>
          <div className="filter-row" aria-label="Тип результатов">
            {([['all', 'Все'], ['teacher', 'Преподаватели'], ['group', 'Группы']] as const).map(([id, label]) =>
              <button key={id} className="filter-button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
          </div>
          {favorites.length > 0 && !query && filter !== 'group' && <div className="directory-favorites">
            <h2>Избранные преподаватели</h2>
            <div className="action-row">{favorites.map((item) => <button key={item.id} className="button secondary" onClick={() => showTeacher(item)}>
              <Star size={16} aria-hidden /> {item.name}</button>)}</div>
          </div>}
          <ul className="directory-list">
            {filtered.map((entry) => <li key={entry.id}>
              <button className="person-open" onClick={() => entry.kind === 'teacher' ? showTeacher(entry) : selectGroup(entry)}>
                <span className="avatar" aria-hidden>{entry.kind === 'group' ? <Users size={19} /> : entry.name[0]}</span>
                <span className="person-name"><strong>{entry.name}</strong><small>{entry.kind === 'group' ? (entry.id === group.id ? 'Моя группа' : 'Учебная группа') : 'Преподаватель'}</small></span>
                <ChevronRight size={18} aria-hidden />
              </button>
              {entry.kind === 'teacher' && favoriteButton(entry)}
            </li>)}
          </ul>
          {!filtered.length && <EmptyState title="Совпадений нет" text="Попробуйте другую фамилию или номер группы." />}
          <div className="directory-footer">
            <p>Поиск по загруженным расписаниям и известным группе и преподавателям. Полный список доступен на ТПУ.</p>
            <div className="action-row"><OriginalLink href={filter === 'teacher' ? scheduleUrl(EXAMPLE_TEACHER) : PORTAL} />
              <button className="button secondary" onClick={() => setImportOpen(true)}>Импорт .ics</button></div>
          </div>
        </section>}

        {route.page === 'settings' && <div className="settings-grid">
          <section className="settings-card surface"><h2>Оформление</h2><p>Выберите тему приложения.</p>
            <div className="segmented" aria-label="Цветовая тема">
              {([['system', 'Системная'], ['light', 'Светлая'], ['dark', 'Тёмная']] as const).map(([id, label]) =>
                <button key={id} aria-pressed={prefs.theme === id} onClick={() => setPrefs({ ...prefs, theme: id as Theme })}>{label}</button>)}
            </div>
          </section>
          <section className="settings-card surface"><h2>Моя группа</h2><p>{group.name}</p>
            <button className="button secondary" onClick={openGroupSearch}>Сменить группу</button>
          </section>
          <section className="settings-card surface"><h2>Данные расписания</h2><p>Файлы .ics и избранное хранятся в браузере. Выгрузки ТПУ появляются после публикации или ручного импорта.</p>
            <div className="action-row"><button className="button primary" onClick={() => setImportOpen(true)}><FileUp size={17} aria-hidden /> Импорт .ics</button>
              <button className="button secondary" disabled={!online || source === 'loading'} onClick={reloadPublished}>Проверить обновление</button></div>
          </section>
          <section className="settings-card surface"><h2>Установка</h2><p>{isStandalone() ? 'Приложение открыто в отдельном окне.' : 'Добавьте расписание на домашний экран.'}</p>
            {!isStandalone() && <button className="button secondary" onClick={install}><ArrowDownToLine size={17} aria-hidden /> Установить приложение</button>}
            {installHelp && <p className="install-help">На iPhone откройте меню «Поделиться» и выберите «На экран Домой». На Android откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».</p>}
          </section>
        </div>}
        {source === 'error' && online && <div className="notice network-notice" role="status">
          <span>Свежая выгрузка недоступна. Можно открыть сохранённые данные или перейти на ТПУ.</span>
          <button className="text-button" onClick={reloadPublished}>Повторить</button>
        </div>}
        <footer><a href={PORTAL} target="_blank" rel="noreferrer">Источник: ИПК Расписание ТПУ <ArrowUpRight size={14} aria-hidden /></a></footer>
      </main>
    </div>
    {importOpen && <ImportDialog person={person} directory={directory} date={day} onSave={saveImport} onClose={() => setImportOpen(false)} />}
  </div>;
}
