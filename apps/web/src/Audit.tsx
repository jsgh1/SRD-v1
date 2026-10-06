import { useEffect, useState } from 'react';
import { api, type Principal } from './api';
import type { AuditExportPdfData } from './AuditExportPdf';
import { AuditDelivery } from './AuditDelivery';
import { Empty, ErrorBox, Loading, Modal } from './ui';
import { ExportFilename, addExportFilename, exportFilenameReady, safeXlsxFilename, type ExportFilenameChoice } from './ExportFilename';

type Event = { id: string; occurred_at: string; service: string; action: string; result: string; actor_id: string | null; resource_id: string | null; correlation_id: string };
type Page = { items: Event[]; total: number; page: number; page_size: number };
type Workbook = { filename: string; mime: string; content: string; count: number };
const initial = { date_from: '', date_to: '', actor_id: '', service: '', action: '', result: '', page_size: '25' };
const services: Record<string, string> = { identity: 'Identidad', configuration: 'Configuración', records: 'Registros', files: 'Archivos', calendar: 'Calendario', notifications: 'Notificaciones', treasury: 'Tesorería', inventory: 'Inventario', chat: 'Chat' };
const results: Record<string, string> = { success: 'Correcto', rejected: 'Rechazado', failed: 'Fallido' };

export function Audit({ principal }: { principal: Principal }) {
  const [draft, setDraft] = useState(initial), [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<Page>(), [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(true), [selected, setSelected] = useState<Event>();
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState<unknown>();
  const [exportName, setExportName] = useState<ExportFilenameChoice>({ name: '', confirmed: false });
  useEffect(() => {
    let active = true;
    setBusy(true); setError(undefined); setData(undefined);
    const query = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([key, value]) => { if (value.trim()) query.set(key, value.trim()); });
    api<Page>(`audit-events?${query}`).then(value => { if (active) setData(value); })
      .catch(value => { if (active) setError(value); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [filters, page, refresh]);
  const field = (key: keyof typeof initial) => ({ value: draft[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft({ ...draft, [key]: e.target.value }) });
  async function exportExcel(format: 'xlsx' | 'pdf' = 'xlsx') {
    if (exporting) return;
    setExporting(true); setExportError(undefined);
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (key !== 'page_size' && value.trim()) query.set(key, value.trim()); });
      addExportFilename(query, exportName);
      if (format === 'pdf') {
        const data = await api<AuditExportPdfData>(`audit-events/export-pdf?${query}`);
        const { downloadAuditExportPdf } = await import('./AuditExportPdf');
        await downloadAuditExportPdf(data, principal.organization.name);
        return;
      }
      const file = await api<Workbook>(`audit-events/export?${query}`);
      if (!safeXlsxFilename(file.filename) || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') throw new Error('La exportación no tiene un formato válido.');
      const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setExportError(e); }
    finally { setExporting(false); }
  }
  return <>
    <div className="page-heading"><div><h1>Auditoría</h1><p className="muted">Historial de acciones de tu junta. La entrega se procesa cada minuto y puede demorarse cuando hay fallos.</p></div>
      <button disabled={busy} onClick={() => setRefresh(value => value + 1)}>Actualizar</button></div>
    <section className="panel" aria-label="Consulta de auditoría">
      <h2>Buscar eventos</h2><p className="muted">Combina los filtros. Las fechas incluyen el día completo en UTC; actor y acción requieren coincidencia exacta.</p>
      <form onSubmit={e => { e.preventDefault(); setPage(1); setFilters({ ...draft }); }}>
        <div className="form-grid">
          <label>Desde (UTC)<input type="date" {...field('date_from')} /></label>
          <label>Hasta (UTC)<input type="date" min={draft.date_from || undefined} {...field('date_to')} /></label>
          <label>Actor (identificador)<input maxLength={36} placeholder="UUID del actor" {...field('actor_id')} /></label>
          <label>Módulo<select {...field('service')}><option value="">Todos</option>{Object.entries(services).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label>Acción<input maxLength={100} placeholder="Ej.: person.created" {...field('action')} /></label>
          <label>Resultado<select {...field('result')}><option value="">Todos</option>{Object.entries(results).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label>Eventos por página<select {...field('page_size')}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        </div>
        <div className="pagination"><button type="submit">Aplicar filtros</button><button type="button" onClick={() => { setDraft(initial); setFilters({ ...initial }); setPage(1); }}>Limpiar filtros</button></div>
      </form>
      <ErrorBox error={error} />
      <ErrorBox error={exportError} />
      <ExportFilename value={exportName} onChange={setExportName} type="auditoria"
        defaultDescription="Si dejas el nombre vacío, se descargará como auditoria_AAAA-MM-DD.xlsx o auditoria_AAAA-MM-DD.pdf, según el formato, con la fecha de Colombia." />
      {busy ? <Loading /> : data && <>
        <p role="status">{data.total} eventos encontrados</p>
        <div className="pagination"><button type="button" disabled={exporting || data.total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportExcel()}>{exporting ? 'Preparando archivo…' : 'Exportar Excel'}</button>
          <button type="button" disabled={exporting || data.total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportExcel('pdf')}>{exporting ? 'Preparando archivo…' : 'Exportar PDF'}</button>
          <span>Usa los filtros aplicados; máximo 2000 eventos por archivo. Si hay más, acota la consulta. PDF en A3 horizontal; fechas de los eventos en UTC.</span></div>
        {data.items.length ? <div className="table-scroll"><table><thead><tr><th>Fecha UTC</th><th>Módulo</th><th>Acción</th><th>Resultado</th><th>Detalle</th></tr></thead>
          <tbody>{data.items.map(event => <tr key={event.id}><td>{event.occurred_at}</td><td>{services[event.service] || event.service}</td><td>{event.action}</td><td>{results[event.result] || event.result}</td><td><button onClick={() => setSelected(event)} aria-label={`Ver evento ${event.id}`}>Ver</button></td></tr>)}</tbody></table></div>
          : <Empty title="No hay eventos para esta consulta">Modifica los filtros o actualiza cuando se hayan entregado nuevas acciones.</Empty>}
        <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page} de {Math.max(1, Math.ceil(data.total / data.page_size))}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
      </>}
    </section>
    <AuditDelivery canRetry={principal.role === 'superadmin' || principal.role === 'admin'} />
    {selected && <Modal title="Detalle del evento" onClose={() => setSelected(undefined)}><dl className="audit-detail">
      {Object.entries({ Evento: selected.id, 'Fecha UTC': selected.occurred_at, Módulo: services[selected.service] || selected.service, Acción: selected.action, Resultado: results[selected.result] || selected.result, Actor: selected.actor_id || 'Sin actor asociado', Recurso: selected.resource_id || 'Sin recurso asociado', Correlación: selected.correlation_id }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl></Modal>}
  </>;
}
