import { useEffect, useState } from 'react';
import { ApiError, api } from './api';

type SchedulerStatus = {
  items: { service: string; available: boolean }[];
};

const labels: Record<string, string> = {
  identity: 'Identidad', configuration: 'Configuración', records: 'Registros',
  files: 'Archivos', calendar: 'Calendario', notifications: 'Notificaciones',
  treasury: 'Tesorería', inventory: 'Inventario', chat: 'Chat',
};

export function SchedulerAlert({ onOpen }: { onOpen: () => void }) {
  const [failed, setFailed] = useState<string[]>([]);
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
        const result = await api<SchedulerStatus>('system/schedulers');
        if (active) {
          setFailed(result.items.filter(item => !item.available).map(item => labels[item.service] ?? item.service));
          setUnavailable(false);
        }
      } catch (reason) {
        if (active) {
          if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
            unauthorized = true;
            setFailed([]);
            setUnavailable(false);
          } else {
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

  if (!failed.length && !unavailable) return null;
  return <aside className="scheduler-alert" role="alert" aria-label="Alerta de planificadores">
    <div>
      <strong>{failed.length ? `${failed.length} planificador${failed.length === 1 ? '' : 'es'} sin señal reciente` : 'No se pudo comprobar el estado de los planificadores'}</strong>
      {failed.length > 0 && <p>Revisar: {failed.join(', ')}. Algunas tareas o avisos podrían retrasarse.</p>}
      {unavailable && <p>La última consulta falló. Comprueba el estado en Configuración.</p>}
    </div>
    <button type="button" onClick={onOpen}>Ver estado</button>
  </aside>;
}
