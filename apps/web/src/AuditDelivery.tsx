import { useEffect, useState } from 'react';
import { api } from './api';
import { ErrorBox, Loading } from './ui';

type Delivery = { published: number; pending: number; due: number; deferred: number; exhausted: number; exhausted_events: { id: string; action: string; attempts: number; occurred_at: string }[] };
const services = [{ id: 'identity', name: 'Identidad' }, { id: 'configuration', name: 'Configuración' }, { id: 'records', name: 'Registros' }];

export function AuditDelivery() {
  const [results, setResults] = useState<PromiseSettledResult<Delivery>[]>([]);
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    try { setResults(await Promise.allSettled(services.map(service => api<Delivery>(`audit-delivery/${service.id}`)))); }
    finally { setBusy(false); }
  }
  useEffect(() => { refresh(); }, []);
  return <section className="panel" aria-label="Estado de entrega de auditoría">
    <div className="section-heading delivery-heading"><h2>Entrega de auditoría</h2><button disabled={busy} onClick={refresh}>Actualizar entregas</button></div>
    <p className="muted">Estado de los eventos de esta junta. Pendientes incluye los listos, los que esperan y los que agotaron sus intentos.</p>
    {busy && <Loading />}
    <div className="delivery-grid">
      {services.map((service, index) => {
        const result = results[index];
        return <article className="delivery-card" key={service.id}>
          <h3>{service.name}</h3>
          {result?.status === 'rejected' && <ErrorBox error={result.reason} />}
          {result?.status === 'fulfilled' && <>
            <dl>{[['Entregados', result.value.published], ['Pendientes', result.value.pending], ['Listos', result.value.due], ['En espera', result.value.deferred], ['Agotados', result.value.exhausted]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            {!!result.value.exhausted && <details><summary>Eventos agotados ({result.value.exhausted_events.length} de {result.value.exhausted})</summary>
              <div className="table-scroll"><table><thead><tr><th>Evento</th><th>Acción</th><th>Fallos</th><th>Fecha UTC</th></tr></thead><tbody>
                {result.value.exhausted_events.map(event => <tr key={event.id}><td>{event.id}</td><td>{event.action}</td><td>{event.attempts}</td><td>{event.occurred_at}</td></tr>)}
              </tbody></table></div><p>Se muestran como máximo 20. Estos eventos requieren revisión; actualizar la vista no los reenvía.</p>
            </details>}
          </>}
        </article>;
      })}
    </div>
  </section>;
}
