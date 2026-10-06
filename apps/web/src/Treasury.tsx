import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type Principal } from './api';
import { Empty, ErrorBox, Loading, Modal } from './ui';
import { ExportFilename, addExportFilename, exportFilenameReady, safeXlsxFilename, type ExportFilenameChoice } from './ExportFilename';
import type { TreasuryReceipt } from './TreasuryReceiptPdf';
import type { TreasuryHistoryPdfData } from './TreasuryHistoryPdf';

type Receipt = TreasuryReceipt;
type Summary = { opened: boolean; balance: string; opening: string; credits: string; debits: string;
  items: Receipt[]; page: number; page_size: number; total: number };
type Workbook = { filename: string; mime: string; content: string; count: number };
type Form = { kind: 'income' | 'expense'; amount: string; effective_date: string; concept: string; support_note: string };
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const blank = (): Form => ({ kind: 'income', amount: '', effective_date: today(), concept: '', support_note: '' });
const labels = { opening: 'Apertura', income: 'Ingreso', expense: 'Egreso', reversal: 'Reverso' };
const cop = (value: string) => {
  const [whole, fraction = '00'] = value.split('.');
  return `$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`;
};

export function Treasury({ principal }: { principal: Principal }) {
  const [data, setData] = useState<Summary>(), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [query, setQuery] = useState('');
  const [form, setForm] = useState<Form>(blank), [mode, setMode] = useState<'opening' | 'movement' | null>(null);
  const [selected, setSelected] = useState<Receipt>(), [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState<unknown>();
  const [exportName, setExportName] = useState<ExportFilenameChoice>({ name: '', confirmed: false });
  const [receiptExporting, setReceiptExporting] = useState(false), [receiptExportError, setReceiptExportError] = useState<unknown>();
  const [receiptName, setReceiptName] = useState<ExportFilenameChoice>({ name: '', confirmed: false });
  useEffect(() => { setReceiptName({ name: '', confirmed: false }); setReceiptExportError(undefined); }, [selected?.id]);
  const postKey = useRef<string | undefined>(undefined), reverseKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page) });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (query.trim()) params.set('q', query.trim());
    setLoading(true);
    api<Summary>(`treasury?${params}`).then(value => { if (active) { setData(value); setError(undefined); } })
      .catch(value => { if (active) setError(value); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [principal.organization.id, page, from, to, query, refresh]);
  async function exportExcel(format: 'xlsx' | 'pdf' = 'xlsx') {
    if (exporting) return;
    setExporting(true); setExportError(undefined);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (query.trim()) params.set('q', query.trim());
      addExportFilename(params, exportName);
      if (format === 'pdf') {
        const data = await api<TreasuryHistoryPdfData>(`treasury/export-pdf?${params}`);
        const { downloadTreasuryHistoryPdf } = await import('./TreasuryHistoryPdf');
        await downloadTreasuryHistoryPdf(data, principal.organization.name);
        return;
      }
      const file = await api<Workbook>(`treasury/export?${params}`);
      if (!safeXlsxFilename(file.filename)
        || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        throw new Error('La exportación no tiene un formato válido.');
      }
      const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { setExportError(value); }
    finally { setExporting(false); }
  }
  function update<K extends keyof Form>(key: K, value: Form[K]) {
    postKey.current = undefined;
    setForm(current => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode || busy) return;
    postKey.current ??= crypto.randomUUID();
    setBusy(true); setError(undefined);
    try {
      const receipt = await api<Receipt>(mode === 'opening' ? 'treasury/opening' : 'treasury/movements', 'POST', {
        ...(mode === 'movement' ? { kind: form.kind } : {}),
        amount: form.amount, effective_date: form.effective_date, concept: form.concept.trim(),
        support_note: form.support_note.trim() || null, idempotency_key: postKey.current,
      });
      postKey.current = undefined;
      setSelected(receipt); setMode(null); setForm(blank()); setRefresh(value => value + 1);
    } catch (value) { setError(value); } finally { setBusy(false); }
  }
  async function show(id: string) {
    setBusy(true); setError(undefined); setReceiptExportError(undefined);
    try { setSelected(await api<Receipt>(`treasury/movements/${id}`)); setReason(''); reverseKey.current = undefined; }
    catch (value) { setError(value); } finally { setBusy(false); }
  }
  async function exportReceiptPdf() {
    if (!selected || receiptExporting || busy || !exportFilenameReady(receiptName)) return;
    setReceiptExporting(true); setReceiptExportError(undefined);
    try {
      const params = new URLSearchParams();
      addExportFilename(params, receiptName);
      const data = await api<{ filename: string; receipt: Receipt }>(`treasury/movements/${selected.id}/pdf?${params}`);
      const { downloadTreasuryReceiptPdf } = await import('./TreasuryReceiptPdf');
      await downloadTreasuryReceiptPdf(data.receipt, principal.organization.name, data.filename);
    } catch (value) { setReceiptExportError(value); }
    finally { setReceiptExporting(false); }
  }
  async function exportReceiptExcel() {
    if (!selected || receiptExporting || busy || !exportFilenameReady(receiptName)) return;
    setReceiptExporting(true); setReceiptExportError(undefined);
    try {
      const params = new URLSearchParams();
      addExportFilename(params, receiptName);
      const file = await api<Workbook>(`treasury/movements/${selected.id}/xlsx?${params}`);
      if (!safeXlsxFilename(file.filename) || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        throw new Error('La exportación no tiene un formato válido.');
      }
      const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { setReceiptExportError(value); }
    finally { setReceiptExporting(false); }
  }
  async function reverse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    reverseKey.current ??= crypto.randomUUID();
    setBusy(true); setError(undefined);
    try {
      const receipt = await api<Receipt>(`treasury/movements/${selected.id}/reverse`, 'POST', {
        reason: reason.trim(), idempotency_key: reverseKey.current,
      });
      reverseKey.current = undefined; setReason(''); setSelected(receipt); setRefresh(value => value + 1);
    } catch (value) { setError(value); } finally { setBusy(false); }
  }
  return <>
    <div className="page-heading"><div><h1>Tesorería</h1><p className="muted">Control de movimientos de {principal.organization.name} · pesos colombianos</p></div></div>
    <ErrorBox error={error} />
    {loading && !data && <Loading />}
    {data && <>
      <div className="treasury-summary">
        <section className="panel"><span>Saldo actual</span><strong>{cop(data.balance)}</strong><small>Derivado de asientos confirmados</small></section>
        <section className="panel"><span>Apertura</span><strong>{cop(data.opening)}</strong></section>
        <section className="panel"><span>Entradas posteriores</span><strong>{cop(data.credits)}</strong></section>
        <section className="panel"><span>Salidas posteriores</span><strong>{cop(data.debits)}</strong></section>
      </div>
      {!data.opened ? <section className="panel"><h2>Iniciar cuenta de la junta</h2><p>Registra el saldo inicial una sola vez. Puede ser cero.</p><button type="button" className="primary" onClick={() => { setForm(blank()); setMode('opening'); }}>Registrar apertura</button></section>
        : <div className="treasury-actions"><button type="button" className="primary" onClick={() => { setForm(blank()); setMode('movement'); }}>Registrar ingreso o egreso</button></div>}
      <section className="panel" aria-label="Historial de tesorería">
        <div className="section-heading"><h2>Movimientos</h2><button type="button" onClick={() => setRefresh(value => value + 1)}>Actualizar</button></div>
        <div className="form-grid treasury-filters"><label>Desde<input type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} /></label><label>Hasta<input type="date" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} /></label><label>Concepto o comprobante<input maxLength={120} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label></div>
        <ErrorBox error={exportError} />
        <ExportFilename value={exportName} onChange={setExportName} type="tesoreria"
          defaultDescription="Si dejas el nombre vacío, se descargará como tesoreria_AAAA-MM-DD.xlsx o tesoreria_AAAA-MM-DD.pdf, según el formato, con la fecha de Colombia." />
        <div className="pagination"><button type="button" disabled={exporting || loading || data.total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportExcel()}>{exporting ? 'Preparando archivo…' : 'Exportar Excel'}</button>
          <button type="button" disabled={exporting || loading || data.total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportExcel('pdf')}>{exporting ? 'Preparando archivo…' : 'Exportar PDF'}</button>
          <span>Incluye todos los asientos de la junta que cumplen los filtros, hasta 2000; no solo la página visible. El saldo tras asiento conserva el valor al confirmar cada comprobante.</span></div>
        {loading && <Loading />}
        {data.items.length ? <div className="table-scroll"><table><thead><tr><th>Comprobante</th><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Responsable</th><th>Importe</th><th>Saldo tras asiento</th><th></th></tr></thead><tbody>
          {data.items.map(item => <tr key={item.id}><td>{item.receipt}</td><td>{item.effective_date}</td><td>{labels[item.kind]}</td><td>{item.concept}</td><td>{item.actor_name}</td><td>{item.sign === -1 ? '−' : '+'}{cop(item.amount)}</td><td>{cop(item.balance_after)}</td><td><button type="button" onClick={() => show(item.id)}>Ver comprobante</button></td></tr>)}
        </tbody></table></div> : <Empty title="Sin movimientos">{data.opened ? 'No hay asientos en este período.' : 'Registra la apertura para comenzar.'}</Empty>}
        {data.total > data.page_size && <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page} · {data.total} movimientos</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>}
      </section>
    </>}
    {mode && <Modal title={mode === 'opening' ? 'Registrar apertura' : 'Registrar movimiento'} onClose={() => setMode(null)}>
      <form onSubmit={submit} className="treasury-form">
        {mode === 'movement' && <label>Tipo<select value={form.kind} onChange={event => update('kind', event.target.value as Form['kind'])}><option value="income">Ingreso</option><option value="expense">Egreso</option></select></label>}
        <label>Importe COP<input type="text" inputMode="decimal" required pattern="(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?" placeholder="0.00" value={form.amount} onChange={event => update('amount', event.target.value)} /></label>
        <label>Fecha efectiva<input type="date" required max={today()} value={form.effective_date} onChange={event => update('effective_date', event.target.value)} /></label>
        <label>Concepto<textarea required minLength={3} maxLength={500} value={form.concept} onChange={event => update('concept', event.target.value)} /></label>
        <label>Referencia del soporte (opcional)<input maxLength={500} value={form.support_note} onChange={event => update('support_note', event.target.value)} /></label>
        <p className="muted">Esta cuenta registra información; no mueve dinero real. Los asientos confirmados se corrigen mediante reverso.</p>
        <ErrorBox error={error} /><button className="primary" disabled={busy}>Guardar y generar comprobante</button>
      </form>
    </Modal>}
    {selected && !mode && <Modal title={`Comprobante ${selected.receipt}`} onClose={() => { setSelected(undefined); setError(undefined); }}>
      <dl className="treasury-receipt">
        <div><dt>Tipo</dt><dd>{labels[selected.kind]}</dd></div><div><dt>Importe</dt><dd>{selected.sign === -1 ? '−' : '+'}{cop(selected.amount)}</dd></div>
        <div><dt>Concepto</dt><dd>{selected.concept}</dd></div><div><dt>Fecha efectiva</dt><dd>{selected.effective_date}</dd></div>
        <div><dt>Responsable</dt><dd>{selected.actor_name}</dd></div><div><dt>Saldo tras asiento</dt><dd>{cop(selected.balance_after)}</dd></div>
        {selected.support_note && <div><dt>Referencia del soporte</dt><dd>{selected.support_note}</dd></div>}
        {selected.reverses_id && <div><dt>Revierte a</dt><dd>{selected.reverses_id}</dd></div>}
        {selected.reversed_by_id && <div><dt>Revertido por</dt><dd>{selected.reversed_by_id}</dd></div>}
      </dl>
      <ErrorBox error={receiptExportError} />
      <ExportFilename value={receiptName} onChange={setReceiptName} type="tesoreria"
        defaultDescription={`Si dejas el nombre vacío, se descargará como comprobante_${selected.receipt}.pdf o comprobante_${selected.receipt}.xlsx, según el formato.`} />
      <button type="button" disabled={busy || receiptExporting || !exportFilenameReady(receiptName)} onClick={() => void exportReceiptPdf()}>
        {receiptExporting ? 'Preparando comprobante…' : 'Descargar comprobante PDF'}
      </button>
      <button type="button" disabled={busy || receiptExporting || !exportFilenameReady(receiptName)} onClick={() => void exportReceiptExcel()}>
        {receiptExporting ? 'Preparando comprobante…' : 'Descargar comprobante Excel'}
      </button>
      {['income', 'expense'].includes(selected.kind) && !selected.reversed_by_id && <form onSubmit={reverse} className="treasury-form"><h3>Corregir mediante reverso</h3><label>Motivo del reverso<textarea required minLength={10} maxLength={500} value={reason} onChange={event => { reverseKey.current = undefined; setReason(event.target.value); }} /></label><ErrorBox error={error} /><button disabled={busy}>Registrar reverso</button></form>}
    </Modal>}
  </>;
}
