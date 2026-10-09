import { useEffect, useState } from 'react';
import { api, ApiError, type Principal } from './api';
import { t } from './i18n';

const labels: Record<string, string> = { online: 'En línea', away: 'Ausente', dnd: 'No molestar', invisible: 'Invisible', offline: 'Desconectado' };
type Heartbeat = { effective: string; preference: string; ttl_seconds: number };

export function Presence({ principal }: { principal: Principal }) {
  const [state, setState] = useState<string>('connecting');
  useEffect(() => {
    let active = true, stopped = false, pending = false;
    async function beat() {
      if (stopped || pending) return;
      pending = true;
      try {
        const result = await api<Heartbeat>('presence/heartbeat', 'POST');
        if (active) setState(result.preference === 'invisible' ? 'invisible' : result.effective);
      } catch (error) {
        if (active) setState(error instanceof ApiError && [401, 403].includes(error.status) ? 'expired' : 'unconfirmed');
        if (error instanceof ApiError && [401, 403].includes(error.status)) stopped = true;
      } finally { pending = false; }
    }
    void beat();
    const interval = window.setInterval(() => void beat(), 30000);
    const resume = () => { if (document.visibilityState === 'visible') void beat(); };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { active = false; stopped = true; clearInterval(interval); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [principal.user_id, principal.organization.id, principal.user.presence]);
  const label = t(labels[state] ?? ({ connecting: 'Conectando', unconfirmed: 'Conexión sin confirmar', expired: 'Sesión sin acceso' }[state]));
  return <span className="presence-status" data-state={state} role="status" aria-label={t('Tu presencia: {status}', {status: label})} title={t(state === 'invisible' ? 'Tu estado público es Desconectado.' : 'La conexión se confirma cada 30 segundos; no prolonga tu sesión.')}><span aria-hidden="true">●</span> {label}</span>;
}
