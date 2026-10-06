import { useEffect, useState } from 'react';
import { ApiError, api } from './api';

type Overview = { items: { service: string; available: boolean; exhausted: number | null }[] };
const labels: Record<string, string> = {
  identity: 'Identidad', configuration: 'Configuración', records: 'Registros',
  files: 'Archivos', calendar: 'Calendario', notifications: 'Notificaciones',
  treasury: 'Tesorería', inventory: 'Inventario', chat: 'Chat',
};

export function AuditDeliveryAlert({ onOpen }: { onOpen: () => void }) {
  const [items, setItems] = useState<Overview['items']>([]);
  const [unavailable, setUnavailable] = useState(false);

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
        const result = await api<Overview>('system/audit-deliveries');
        if (active) {
          setItems(result.items);
          setUnavailable(false);
        }
      } catch (reason) {
        if (active) {
          if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
            unauthorized = true;
            setItems([]);
            setUnavailable(false);
          } else {
            setItems([]);
            setUnavailable(true);
          }
        }
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

  const failed = items.filter(item => item.available && (item.exhausted ?? 0) > 0);
  const missing = items.filter(item => !item.available);
  const count = failed.reduce((total, item) => total + (item.exhausted ?? 0), 0);
  if (!count && !missing.length && !unavailable) return null;
  return <aside className="scheduler-alert" role="alert" aria-label="Alerta de auditoría">
    <div>
      <strong>{count ? `${count} evento${count === 1 ? '' : 's'} de auditoría con entrega agotada` : 'No se pudo comprobar toda la entrega de auditoría'}</strong>
      {failed.length > 0 && <p>Revisar: {failed.map(item => `${labels[item.service] ?? item.service} (${item.exhausted})`).join(', ')}.</p>}
      {(missing.length > 0 || unavailable) && <p>El estado de {unavailable ? 'los servicios' : missing.map(item => labels[item.service] ?? item.service).join(', ')} no está disponible.</p>}
    </div>
    <button type="button" onClick={onOpen}>Ver auditoría</button>
  </aside>;
}
