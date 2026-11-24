import { Users } from 'lucide-react';
import { useState } from 'react';
import type { Person } from './data.ts';
import { teacherPortrait } from './teacher-portraits.ts';

export function PersonAvatar({ person, size = 'normal' }: {
  person: Person; size?: 'small' | 'normal' | 'large';
}) {
  const portrait = teacherPortrait(person);
  const [image, setImage] = useState<{ url: string; status: 'ready' | 'error' }>();
  const status = image?.url === portrait?.url ? image?.status : undefined;
  const initials = person.kind === 'teacher'
    ? person.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('ru')
    : undefined;

  return <span className={`avatar avatar-${size}`} aria-hidden data-initials={initials}>
    {person.kind === 'group' && <Users size={19} />}
    {portrait && status !== 'error' && <img
      key={portrait.url} src={portrait.url} alt="" loading={size === 'large' ? 'eager' : 'lazy'}
      decoding="async" referrerPolicy="no-referrer"
      className={status === 'ready' ? 'avatar-photo is-ready' : 'avatar-photo'}
      onLoad={() => setImage({ url: portrait.url, status: 'ready' })}
      onError={() => setImage({ url: portrait.url, status: 'error' })}
    />}
  </span>;
}
