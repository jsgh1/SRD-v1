import { useEffect, useState } from 'react';
import { api, type Principal } from './api';
import type { AuditExportPdfData } from './AuditExportPdf';
import { AuditDelivery } from './AuditDelivery';
import { Empty, ErrorBox, Loading, Modal } from './ui';
import { ExportFilename, addExportFilename, exportFilenameReady, safeXlsxFilename, type ExportFilenameChoice } from './ExportFilename';
import { t, useLanguage } from './i18n';

type Event = { id: string; occurred_at: string; service: string; action: string; result: string; actor_id: string | null; resource_id: string | null; correlation_id: string };
type Page = { items: Event[]; total: number; page: number; page_size: number };
type Workbook = { filename: string; mime: string; content: string; count: number };
const initial = { date_from: '', date_to: '', actor_id: '', service: '', action: '', result: '', page_size: '25' };
const services: Record<string, string> = { identity: 'Identidad', configuration: 'Configuración', records: 'Registros', files: 'Archivos', calendar: 'Calendario', notifications: 'Notificaciones', treasury: 'Tesorería', inventory: 'Inventario', chat: 'Chat' };
const results: Record<string, string> = { success: 'Correcto', rejected: 'Rechazado', failed: 'Fallido' };

export function Audit({ principal }: { principal: Principal }) {
  const language = useLanguage();
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
      query.set('lang', language);
      addExportFilename(query, exportName);
      if (format === 'pdf') {
        const data = await api<AuditExportPdfData>(`audit-events/export-pdf?${query}`);
        const { downloadAuditExportPdf } = await import('./AuditExportPdf');
        await downloadAuditExportPdf(data, principal.organization.name);
        return;
      }
      const file = await api<Workbook>(`audit-events/export?${query}`);
      if (!safeXlsxFilename(file.filename) || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') throw new Error(t('La exportación no tiene un formato válido.'));
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
    <div className="page-heading"><div><h1>{t('Auditoría')}</h1><p className="muted">{t('Historial de acciones de tu junta. La entrega se procesa cada minuto y puede demorarse cuando hay fallos.')}</p></div>
      <button disabled={busy} onClick={() => setRefresh(value => value + 1)}>{t('Actualizar')}</button></div>
    <section className="panel" aria-label={t('Consulta de auditoría')}>
      <h2>{t('Buscar eventos')}</h2><p className="muted">{t('Combina los filtros. Las fechas incluyen el día completo en UTC; actor y acción requieren coincidencia exacta.')}</p>
      <form onSubmit={e => { e.preventDefault(); setPage(1); setFilters({ ...draft }); }}>
        <div className="form-grid">
          <label>{t('Desde (UTC)')}<input type="date" {...field('date_from')} /></label>
          <label>{t('Hasta (UTC)')}<input type="date" min={draft.date_from || undefined} {...field('date_to')} /></label>
          <label>{t('Actor (identificador)')}<input maxLength={36} placeholder={t('UUID del actor')} {...field('actor_id')} /></label>
          <label>{t('Módulo')}<select {...field('service')}><option value="">{t('Todos')}</option>{Object.entries(services).map(([id, name]) => <option key={id} value={id}>{t(name)}</option>)}</select></label>
          <label>{t('Acción')}<input maxLength={100} placeholder={t('Ej.: person.created')} {...field('action')} /></label>
          <label>{t('Resultado')}<select {...field('result')}><option value="">{t('Todos')}</option>{Object.entries(results).map(([id, name]) => <option key={id} value={id}>{t(name)}</option>)}</select></label>
          <label>{t('Eventos por página')}<select {...field('page_size')}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        </div>
        <div className="pagination"><button type="submit">{t('Aplicar filtros')}</button><button type="button" onClick={() => { setDraft(initial); setFilters({ ...initial }); setPage(1); }}>{t('Limpiar filtros')}</button></div>
      </form>
      <ErrorBox error={error} />
      <ErrorBox error={exportError} />
      <ExportFilename value={exportName} onChange={setExportName} type="auditoria"
        defaultDescription={t('Si dejas el nombre vacío, se descargará como auditoria_AAAA-MM-DD.xlsx o auditoria_AAAA-MM-DD.pdf, según el formato, con la fecha de Colombia.')} />
      {busy ? <Loading /> : data && <>
        <p role="status">{t('{count} eventos encontrados', { count: data.total })}</p>
        <div className="pagination"><button type="button" disabled={exporting || data.total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportExcel()}>{t(exporting ? 'Preparando archivo…' : 'Exportar Excel')}</button>
          <button type="button" disabled={exporting || data.total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportExcel('pdf')}>{t(exporting ? 'Preparando archivo…' : 'Exportar PDF')}</button>
          <span>{t('Usa los filtros aplicados; máximo 2000 eventos por archivo. Si hay más, acota la consulta. PDF en A3 horizontal; fechas de los eventos en UTC.')}</span></div>
        {data.items.length ? <div className="table-scroll"><table><thead><tr><th>{t('Fecha UTC')}</th><th>{t('Módulo')}</th><th>{t('Acción')}</th><th>{t('Resultado')}</th><th>{t('Detalle')}</th></tr></thead>
          <tbody>{data.items.map(event => <tr key={event.id}><td>{event.occurred_at}</td><td>{t(services[event.service] || event.service)}</td><td>{event.action}</td><td>{t(results[event.result] || event.result)}</td><td><button onClick={() => setSelected(event)} aria-label={t('Ver evento {id}', { id: event.id })}>{t('Ver')}</button></td></tr>)}</tbody></table></div>
          : <Empty title={t('No hay eventos para esta consulta')}>{t('Modifica los filtros o actualiza cuando se hayan entregado nuevas acciones.')}</Empty>}
        <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>{t('Anterior')}</button><span>{t('Página {page} de {pages}', { page, pages: Math.max(1, Math.ceil(data.total / data.page_size)) })}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>{t('Siguiente')}</button></div>
      </>}
    </section>
    <AuditDelivery canRetry={principal.role === 'superadmin' || principal.role === 'admin'} />
    {selected && <Modal title={t('Detalle del evento')} onClose={() => setSelected(undefined)}><dl className="audit-detail">
      {Object.entries({ Evento: selected.id, 'Fecha UTC': selected.occurred_at, Módulo: t(services[selected.service] || selected.service), Acción: selected.action, Resultado: t(results[selected.result] || selected.result), Actor: selected.actor_id || t('Sin actor asociado'), Recurso: selected.resource_id || t('Sin recurso asociado'), Correlación: selected.correlation_id }).map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}
    </dl></Modal>}
  </>;
}
