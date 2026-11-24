import { ExternalLink, FileUp, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { scheduleUrl } from './calendar.ts';
import { findPerson, searchKey, type Kind, type Person, type Snapshot } from './data.ts';

export function ImportDialog({ person, directory, date, onSave, onClose }: {
  person: Person; directory: Person[]; date: string;
  onSave: (snapshot: Snapshot) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState(person.kind);
  const [name, setName] = useState(person.name);
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  function sourceId(value: string, kind: Kind) {
    if (!value.trim()) return undefined;
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new Error('Вставьте полную ссылку на расписание ТПУ.');
    }
    const path = kind === 'group' ? /^\/gruppa_(\d+)\/\d{4}\/\d+\/view\.html$/ : /^\/user_(\d+)\/\d{4}\/\d+\/view\.html$/;
    const match = url.pathname.match(path);
    if (url.origin !== 'https://ro-rasp.tpu.ru' || !match) throw new Error('Ссылка должна вести на расписание выбранного типа на ro-rasp.tpu.ru.');
    return match[1];
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const file = new FormData(event.currentTarget).get('calendar');
    if (!(file instanceof File) || !file.size) return setMessage('Выберите скачанный .ics-файл.');
    if (file.size > 2_000_000) return setMessage('Размер файла должен быть меньше 2 МБ.');
    setPending(true);
    try {
      const label = name.trim();
      if (!label) throw new Error('Введите имя преподавателя или номер группы.');
      const known = findPerson(directory, kind, label);
      const official = sourceId(link, kind);
      const id = official ? `${kind}:${official}` : known?.id ?? `${kind}:local:${searchKey(label)}`;
      const existing = directory.find((entry) => entry.id === id);
      const target: Person = { ...existing, id, kind, name: label, sourceId: official ?? known?.sourceId };
      const { importCalendar } = await import('./import-calendar.ts');
      const snapshot = importCalendar(await file.text(), target);
      onSave(snapshot);
    } catch (error) {
      const readable = error instanceof Error && /[А-Яа-яЁё]/.test(error.message);
      setMessage(readable ? error.message : 'Не удалось прочитать файл. Проверьте формат и попробуйте ещё раз.');
    } finally {
      setPending(false);
    }
  }

  return <dialog ref={dialog} className="dialog surface" onClose={onClose} aria-labelledby="import-title">
    <div className="dialog-heading">
      <FileUp size={26} aria-hidden />
      <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть"><X size={20} aria-hidden /></button>
    </div>
    <h2 id="import-title">Импорт расписания</h2>
    <p>На сайте ТПУ выберите «Формат iCal», нужный период и скачайте файл .ics. Добавленные занятия сохранятся на этом устройстве.</p>
    <a className="text-link" href={scheduleUrl(person, date)} target="_blank" rel="noreferrer">
      Перейти на ТПУ <ExternalLink size={15} aria-hidden />
    </a>
    <form onSubmit={submit} className="import-form">
      <label>Владелец расписания
        <select value={kind} onChange={(event) => {
          setKind(event.target.value as Kind);
          setName(event.target.value === person.kind ? person.name : '');
          setLink('');
        }}>
          <option value="group">Учебная группа</option><option value="teacher">Преподаватель</option>
        </select>
      </label>
      <label>{kind === 'group' ? 'Номер группы' : 'Имя преподавателя'}
        <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>Ссылка на расписание ТПУ <small>необязательно</small>
        <input placeholder="https://ro-rasp.tpu.ru/…" type="url" value={link} onChange={(event) => setLink(event.target.value)} />
      </label>
      <label>Файл календаря
        <input required type="file" name="calendar" accept=".ics,text/calendar" />
      </label>
      {message && <p className="form-error" role="alert">{message}</p>}
      <button className="button primary" type="submit" disabled={pending}>
        <FileUp size={17} aria-hidden /> {pending ? 'Читаю календарь…' : 'Загрузить файл'}
      </button>
    </form>
  </dialog>;
}
