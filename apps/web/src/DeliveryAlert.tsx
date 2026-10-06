import { useEffect, useState } from 'react';
import { ApiError, api } from './api';

type CalendarDeliveries = { exhausted: number };
type MailDeliveries = {
  invitations: { exhausted: number };
  security_notices: { exhausted: number };
};

export function DeliveryAlert({ onOpen }: { onOpen: () => void }) {
  const [status, setStatus] = useState<{ calendar?: number; mail?: number; unknown: boolean }>({ unknown: false });

  useEffect(() => {
    let active = true;
    let pending = false;
    let rerun = false;
    let unauthorized = false;
    async function refresh() {
      if (!active || unauthorized || document.hidden) return;
      if (pending) { rerun = true; return; }
      pending = true;
      try {
        const [calendar, mail] = await Promise.allSettled([
          api<CalendarDeliveries>('system/calendar-deliveries'),
          api<MailDeliveries>('system/mail-deliveries'),
        ]);
        if (!active) return;
        if ([calendar, mail].some(result => result.status === 'rejected'
          && result.reason instanceof ApiError && [401, 403].includes(result.reason.status))) {
          unauthorized = true;
          setStatus({ unknown: false });
          return;
        }
        setStatus({
          calendar: calendar.status === 'fulfilled' ? calendar.value.exhausted : undefined,
          mail: mail.status === 'fulfilled' ? mail.value.invitations.exhausted + mail.value.security_notices.exhausted : undefined,
          unknown: calendar.status === 'rejected' || mail.status === 'rejected',
        });
      } finally {
        pending = false;
        if (rerun) { rerun = false; void refresh(); }
      }
    }
    const resume = () => { void refresh(); };
    void refresh();
    const timer = window.setInterval(resume, 60_000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, []);

  const calendar = status.calendar ?? 0;
  const mail = status.mail ?? 0;
  if (!calendar && !mail && !status.unknown) return null;
  return <aside className="scheduler-alert" role="alert" aria-label="Alerta de entregas">
    <div>
      <strong>{calendar || mail ? 'Hay entregas que agotaron sus intentos' : 'No se pudo comprobar el estado de las entregas'}</strong>
      {(calendar > 0 || mail > 0) && <p>{[
        calendar > 0 ? `${calendar} aviso${calendar === 1 ? '' : 's'} de calendario` : null,
        mail > 0 ? `${mail} correo${mail === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' y ')}. Revisa cada trabajo antes de programar otro intento.</p>}
      {status.unknown && <p>Una consulta falló; el estado de las entregas podría estar incompleto.</p>}
    </div>
    <button type="button" onClick={onOpen}>Ver entregas</button>
  </aside>;
}
