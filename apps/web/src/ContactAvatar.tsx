import { useEffect, useState } from 'react';
import { api } from './api';

export function ContactAvatar({ organizationId, userId, name }: { organizationId: string; userId: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSrc(null);
    void api<{ content: string; mime: string }>(`users/${userId}/photos/avatar`)
      .then(photo => { if (active && photo.mime === 'image/png') setSrc(`data:image/png;base64,${photo.content}`); })
      .catch(() => { if (active) setSrc(null); });
    return () => { active = false; };
  }, [organizationId, userId]);

  return <span className="avatar" aria-hidden="true">{src ? <img src={src} alt="" /> : name.slice(0, 1)}</span>;
}
