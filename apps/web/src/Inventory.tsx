import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type Principal } from './api';
import { Empty, ErrorBox, Loading, Modal } from './ui';
import { PersonPhotos } from './PersonPhotos';
import { ExportFilename, addExportFilename, exportFilenameReady, safeXlsxFilename, type ExportFilenameChoice } from './ExportFilename';
import type { InventoryExportPdfData } from './InventoryExportPdf';

type Asset = { id: string; code: string; type: 'real_estate' | 'movable'; name: string; category: string | null;
  unit: string | null; description: string | null; location: string; condition: string; responsible_name: string | null;
  quantity: number; status: 'active' | 'retired'; version: number; retired_at: string | null };
type Movement = { id: string; sequence: number; type: 'opening' | 'in' | 'out' | 'adjust' | 'retire'; delta: number;
  quantity_before: number; quantity_after: number; reason: string; performer_name: string; created_at: string };
type Detail = { asset: Asset; movements: Movement[]; movement_page: number; movement_page_size: number; movement_total: number };
type Workbook = { filename: string; mime: string; content: string; count: number };
type HistoryFilters = { type: string; q: string; from: string; to: string };
const blankHistory = (): HistoryFilters => ({ type: '', q: '', from: '', to: '' });
type AssetForm = { code: string; type: Asset['type']; name: string; category: string; unit: string; description: string;
  location: string; condition: string; responsible_name: string; quantity: string };
const blank = (): AssetForm => ({ code: '', type: 'movable', name: '', category: '', unit: 'unidad', description: '',
  location: '', condition: '', responsible_name: '', quantity: '0' });
const fromAsset = (asset: Asset): AssetForm => ({ code: asset.code, type: asset.type, name: asset.name,
  category: asset.category || '', unit: asset.unit || '', description: asset.description || '',
  location: asset.location, condition: asset.condition, responsible_name: asset.responsible_name || '', quantity: String(asset.quantity) });
const labels = { opening: 'Registro inicial', in: 'Entrada', out: 'Salida', adjust: 'Ajuste', retire: 'Baja' };
const dateTime = (value: string) => new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value.replace(' ', 'T').replace(/(Z|[+-]\d\d:\d\d)$/, '') + 'Z'));

export function Inventory({ principal }: { principal: Principal }) {
  const [items, setItems] = useState<Asset[]>([]), [total, setTotal] = useState(0), [page, setPage] = useState(1);
  const [type, setType] = useState(''), [status, setStatus] = useState('active'), [query, setQuery] = useState('');
  const [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState<unknown>();
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState<unknown>();
  const [exportName, setExportName] = useState<ExportFilenameChoice>({ name: '', confirmed: false });
  const [detail, setDetail] = useState<Detail>(), [mode, setMode] = useState<'create' | 'edit' | 'move' | 'retire' | null>(null);
  const [movementBusy, setMovementBusy] = useState(false), [movementError, setMovementError] = useState<unknown>();
  const [historyDraft, setHistoryDraft] = useState<HistoryFilters>(blankHistory), [historyFilters, setHistoryFilters] = useState<HistoryFilters>(blankHistory);
  const historyGeneration = useRef(0);
  const [historyExporting, setHistoryExporting] = useState(false), [historyExportError, setHistoryExportError] = useState<unknown>();
  const [historyExportName, setHistoryExportName] = useState<ExportFilenameChoice>({ name: '', confirmed: false });
  const [form, setForm] = useState<AssetForm>(blank), [moveType, setMoveType] = useState<'in' | 'out' | 'adjust'>('in');
  const [moveQuantity, setMoveQuantity] = useState('1'), [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  const key = useRef<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page) });
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (query.trim()) params.set('q', query.trim());
    setLoading(true);
    api<{ items: Asset[]; total: number }>(`assets?${params}`).then(value => {
      if (active) { setItems(value.items); setTotal(value.total); setError(undefined); }
    }).catch(value => { if (active) setError(value); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [principal.organization.id, page, type, status, query, refresh]);
  const reload = () => setRefresh(value => value + 1);
  async function exportExcel(format: 'xlsx' | 'pdf' = 'xlsx') {
    if (exporting) return;
    setExporting(true); setExportError(undefined);
    try {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (status) params.set('status', status);
      if (query.trim()) params.set('q', query.trim());
      addExportFilename(params, exportName);
      if (format === 'pdf') {
        const data = await api<InventoryExportPdfData>(`assets/export-pdf?${params}`);
        const { downloadInventoryExportPdf } = await import('./InventoryExportPdf');
        await downloadInventoryExportPdf(data, principal.organization.name);
        return;
      }
      const file = await api<Workbook>(`assets/export?${params}`);
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
  async function show(id: string) {
    const generation = ++historyGeneration.current;
    setBusy(true); setError(undefined);
    try {
      const result = await api<Detail>(`assets/${id}`);
      if (generation !== historyGeneration.current) return;
      setDetail(result); setMovementError(undefined); setMovementBusy(false); setMode(null);
      setHistoryDraft(blankHistory()); setHistoryFilters(blankHistory());
      setHistoryExporting(false); setHistoryExportError(undefined); setHistoryExportName({ name: '', confirmed: false });
    }
    catch (value) { setError(value); } finally { setBusy(false); }
  }
  async function movementPage(pageNumber: number, filters = historyFilters) {
    if (!detail || movementBusy) return;
    const id = detail.asset.id;
    const generation = historyGeneration.current;
    const params = new URLSearchParams({ movement_page: String(pageNumber) });
    for (const [field, value] of Object.entries(filters)) if (value.trim()) params.set(`movement_${field}`, value.trim());
    setMovementBusy(true); setMovementError(undefined);
    try {
      const result = await api<Detail>(`assets/${id}?${params}`);
      if (generation !== historyGeneration.current) return;
      setDetail(current => current?.asset.id === id ? result : current);
      setHistoryFilters(filters);
    } catch (value) { if (generation === historyGeneration.current) setMovementError(value); }
    finally { if (generation === historyGeneration.current) setMovementBusy(false); }
  }
  async function exportHistory(format: 'xlsx' | 'pdf' = 'xlsx') {
    if (!detail || movementBusy || historyExporting || !exportFilenameReady(historyExportName)) return;
    const generation = historyGeneration.current;
    const params = new URLSearchParams();
    for (const [field, value] of Object.entries(historyFilters)) if (value.trim()) params.set(`movement_${field}`, value.trim());
    addExportFilename(params, historyExportName);
    setHistoryExporting(true); setHistoryExportError(undefined);
    try {
      if (format === 'pdf') {
        const data = await api<import('./InventoryHistoryPdf').InventoryHistoryPdfData>(`assets/${detail.asset.id}/movements/export-pdf?${params}`);
        if (generation !== historyGeneration.current) return;
        const { downloadInventoryHistoryPdf } = await import('./InventoryHistoryPdf');
        if (generation !== historyGeneration.current) return;
        await downloadInventoryHistoryPdf(data, principal.organization.name, () => generation === historyGeneration.current);
        return;
      }
      const file = await api<Workbook>(`assets/${detail.asset.id}/movements/export?${params}`);
      if (generation !== historyGeneration.current) return;
      if (!safeXlsxFilename(file.filename) || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') throw new Error('La exportación no tiene un formato válido.');
      const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { if (generation === historyGeneration.current) setHistoryExportError(value); }
    finally { if (generation === historyGeneration.current) setHistoryExporting(false); }
  }
  function change(field: keyof AssetForm, value: string) {
    key.current = undefined;
    setForm(current => ({ ...current, [field]: value, ...(field === 'type' && value === 'real_estate' ? { quantity: '1', unit: '' } : {}) }));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(undefined);
    try {
      if (mode === 'create') {
        key.current ??= crypto.randomUUID();
        const result = await api<{ asset: Asset }>('assets', 'POST', { ...form, quantity: Number(form.quantity), idempotency_key: key.current });
        key.current = undefined; reload(); await show(result.asset.id);
      } else if (mode === 'edit' && detail) {
        await api<Asset>(`assets/${detail.asset.id}`, 'PATCH', { ...form, version: detail.asset.version });
        reload(); await show(detail.asset.id);
      }
    } catch (value) { setError(value); } finally { setBusy(false); }
  }
  async function applyMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail || busy) return;
    key.current ??= crypto.randomUUID(); setBusy(true); setError(undefined);
    try {
      await api(`assets/${detail.asset.id}/movements`, 'POST', {
        type: moveType, quantity: Number(moveQuantity), reason: reason.trim(), idempotency_key: key.current,
      });
      key.current = undefined; reload(); await show(detail.asset.id);
    } catch (value) { setError(value); } finally { setBusy(false); }
  }
  async function retire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail || busy) return;
    key.current ??= crypto.randomUUID(); setBusy(true); setError(undefined);
    try {
      await api(`assets/${detail.asset.id}/retire`, 'POST', {
        version: detail.asset.version, reason: reason.trim(), idempotency_key: key.current,
      });
      key.current = undefined; reload(); await show(detail.asset.id);
    } catch (value) { setError(value); } finally { setBusy(false); }
  }
  const close = () => { setMode(null); setError(undefined); key.current = undefined; };
  return <>
    <div className="page-heading"><div><h1>Inventario</h1><p className="muted">Muebles e inmuebles de {principal.organization.name}</p></div></div>
    <ErrorBox error={error} />
    <div className="treasury-actions"><button className="primary" onClick={() => { setForm(blank()); setDetail(undefined); setMode('create'); key.current = undefined; }}>Registrar bien</button></div>
    <section className="panel" aria-label="Bienes de inventario">
      <div className="section-heading"><h2>Bienes</h2><button onClick={reload}>Actualizar</button></div>
      <div className="form-grid treasury-filters">
        <label>Buscar por código o nombre<input maxLength={120} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
        <label>Tipo<select value={type} onChange={event => { setType(event.target.value); setPage(1); }}><option value="">Todos</option><option value="movable">Muebles</option><option value="real_estate">Inmuebles</option></select></label>
        <label>Estado<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="active">Activos</option><option value="retired">De baja</option><option value="">Todos</option></select></label>
      </div>
      <ErrorBox error={exportError} />
      <ExportFilename value={exportName} onChange={setExportName} type="inventario" defaultDescription="Si dejas el nombre vacío, se descargará como inventario_AAAA-MM-DD.xlsx o inventario_AAAA-MM-DD.pdf, según el formato, con la fecha de Colombia." />
      <div className="pagination"><button type="button" disabled={exporting || loading || total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportExcel()}>{exporting ? 'Preparando archivo…' : 'Exportar Excel'}</button><button type="button" disabled={exporting || loading || total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportExcel('pdf')}>{exporting ? 'Preparando archivo…' : 'Exportar PDF'}</button><span>Incluye todos los bienes de la junta que cumplen los filtros, hasta 2000; no solo la página visible. PDF presenta un resumen por bien. No incluye fotografías.</span></div>
      {loading && <Loading />}
      {items.length ? <div className="table-scroll"><table><thead><tr><th>Código</th><th>Bien</th><th>Tipo</th><th>Ubicación</th><th>Condición</th><th>Existencia</th><th>Estado</th><th></th></tr></thead><tbody>
        {items.map(asset => <tr key={asset.id}><td>{asset.code}</td><td>{asset.name}</td><td>{asset.type === 'movable' ? 'Mueble' : 'Inmueble'}</td><td>{asset.location}</td><td>{asset.condition}</td><td>{asset.quantity}{asset.unit ? ` ${asset.unit}` : ''}</td><td>{asset.status === 'active' ? 'Activo' : 'De baja'}</td><td><button onClick={() => show(asset.id)}>Ver bien</button></td></tr>)}
      </tbody></table></div> : !loading && <Empty title="Sin bienes">Registra un bien o ajusta los filtros.</Empty>}
      {total > 25 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page} · {total} bienes</span><button disabled={page * 25 >= total} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>}
    </section>
    {(mode === 'create' || mode === 'edit') && <Modal title={mode === 'create' ? 'Registrar bien' : 'Editar bien'} onClose={close}>
      <form className="treasury-form" onSubmit={save}>
        {mode === 'create' && <><label>Tipo<select value={form.type} onChange={event => change('type', event.target.value)}><option value="movable">Mueble</option><option value="real_estate">Inmueble</option></select></label><label>Código<input required minLength={2} maxLength={40} pattern="[A-Za-z0-9._-]+" value={form.code} onChange={event => change('code', event.target.value)} /></label></>}
        <label>Nombre<input required minLength={2} maxLength={160} value={form.name} onChange={event => change('name', event.target.value)} /></label>
        {form.type === 'movable' && <><label>Categoría<input required maxLength={80} value={form.category} onChange={event => change('category', event.target.value)} /></label><label>Unidad<input required maxLength={40} value={form.unit} onChange={event => change('unit', event.target.value)} /></label></>}
        <label>Descripción<textarea maxLength={5000} value={form.description} onChange={event => change('description', event.target.value)} /></label>
        <label>Ubicación<input required minLength={2} maxLength={180} value={form.location} onChange={event => change('location', event.target.value)} /></label>
        <label>Condición<input required minLength={2} maxLength={80} value={form.condition} onChange={event => change('condition', event.target.value)} /></label>
        <label>Responsable (opcional)<input maxLength={120} value={form.responsible_name} onChange={event => change('responsible_name', event.target.value)} /></label>
        {mode === 'create' && <label>Cantidad inicial<input type="number" required min="0" max="1000000000" value={form.quantity} disabled={form.type === 'real_estate'} onChange={event => change('quantity', event.target.value)} /></label>}
        <ErrorBox error={error} /><button className="primary" disabled={busy}>Guardar bien</button>
      </form>
    </Modal>}
    {detail && !mode && <Modal title={`${detail.asset.code} · ${detail.asset.name}`} onClose={() => { historyGeneration.current++; setDetail(undefined); setMovementBusy(false); setError(undefined); }}>
      <dl className="treasury-receipt">
        <div><dt>Tipo</dt><dd>{detail.asset.type === 'movable' ? 'Mueble' : 'Inmueble'}</dd></div>
        <div><dt>Existencia</dt><dd>{detail.asset.quantity}{detail.asset.unit ? ` ${detail.asset.unit}` : ''}</dd></div>
        <div><dt>Ubicación</dt><dd>{detail.asset.location}</dd></div><div><dt>Condición</dt><dd>{detail.asset.condition}</dd></div>
        {detail.asset.category && <div><dt>Categoría</dt><dd>{detail.asset.category}</dd></div>}
        {detail.asset.responsible_name && <div><dt>Responsable</dt><dd>{detail.asset.responsible_name}</dd></div>}
        {detail.asset.description && <div><dt>Descripción</dt><dd>{detail.asset.description}</dd></div>}
        <div><dt>Estado</dt><dd>{detail.asset.status === 'active' ? 'Activo' : 'De baja'}</dd></div>
      </dl>
      <PersonPhotos id={detail.asset.id} kind="asset" writable={detail.asset.status === 'active'} />
      {detail.asset.status === 'active' && <div className="treasury-actions">
        <button onClick={() => { setForm(fromAsset(detail.asset)); setMode('edit'); }}>Editar ficha</button>
        {detail.asset.type === 'movable' && <button onClick={() => { setMoveType('in'); setMoveQuantity('1'); setReason(''); key.current = undefined; setMode('move'); }}>Registrar movimiento</button>}
        <button onClick={() => { setReason(''); key.current = undefined; setMode('retire'); }}>Dar de baja</button>
      </div>}
      <h3>Historial de movimientos</h3>
      <form className="form-grid treasury-filters" aria-label="Filtros del historial de inventario" onSubmit={event => { event.preventDefault(); void movementPage(1, { ...historyDraft }); }}>
        <label>Operación del historial<select value={historyDraft.type} onChange={event => setHistoryDraft({ ...historyDraft, type: event.target.value })}>
          <option value="">Todas</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Motivo del movimiento<input maxLength={120} value={historyDraft.q} onChange={event => setHistoryDraft({ ...historyDraft, q: event.target.value })} /></label>
        <label>Movimientos desde<input type="date" value={historyDraft.from} max={historyDraft.to || undefined} onChange={event => setHistoryDraft({ ...historyDraft, from: event.target.value })} /></label>
        <label>Movimientos hasta<input type="date" value={historyDraft.to} min={historyDraft.from || undefined} onChange={event => setHistoryDraft({ ...historyDraft, to: event.target.value })} /></label>
        <div className="pagination"><button type="submit" disabled={movementBusy}>Aplicar filtros</button><button type="button" disabled={movementBusy} onClick={() => { const empty = blankHistory(); setHistoryDraft(empty); void movementPage(1, empty); }}>Limpiar filtros</button></div>
      </form>
      <p className="muted">Fechas inclusivas de Colombia. Los filtros afectan al historial; la existencia actual del bien conserva todos sus movimientos.</p>
      <p role="status">{detail.movement_total} movimientos coincidentes</p>
      <ExportFilename value={historyExportName} onChange={setHistoryExportName} type="movimientos_inventario" defaultDescription="Sin nombre personalizado: movimientos_inventario_AAAA-MM-DD.xlsx o .pdf, con fecha de Colombia." />
      <div className="pagination"><button type="button" disabled={historyExporting || movementBusy || detail.movement_total > 2000 || !exportFilenameReady(historyExportName)} onClick={() => void exportHistory()}>{historyExporting ? 'Preparando historial…' : 'Exportar historial Excel'}</button><button type="button" disabled={historyExporting || movementBusy || detail.movement_total > 2000 || !exportFilenameReady(historyExportName)} onClick={() => void exportHistory('pdf')}>{historyExporting ? 'Preparando historial…' : 'Exportar historial PDF'}</button><span>Todos los movimientos de los filtros aplicados, hasta 2000; no solo la página visible. Fechas del archivo en UTC.</span></div>
      <ErrorBox error={historyExportError} />
      <ErrorBox error={movementError} />
      {movementBusy && <Loading />}
      <div className="table-scroll"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Tipo</th><th>Cambio</th><th>Existencia</th><th>Motivo</th><th>Responsable</th></tr></thead><tbody>
        {detail.movements.map(item => <tr key={item.id}><td>{item.sequence}</td><td>{dateTime(item.created_at)}</td><td>{labels[item.type]}</td><td>{item.delta > 0 ? '+' : ''}{item.delta}</td><td>{item.quantity_after}</td><td>{item.reason}</td><td>{item.performer_name}</td></tr>)}
      </tbody></table></div>
      {!movementBusy && detail.movement_total === 0 && <p className="muted">No hay movimientos que coincidan con los filtros aplicados.</p>}
      {detail.movement_total > detail.movement_page_size && <div className="pagination">
        <button disabled={movementBusy || detail.movement_page === 1} onClick={() => void movementPage(detail.movement_page - 1)}>Movimientos más recientes</button>
        <span>Página {detail.movement_page}</span>
        <button disabled={movementBusy || detail.movement_page * detail.movement_page_size >= detail.movement_total} onClick={() => void movementPage(detail.movement_page + 1)}>Movimientos más antiguos</button>
      </div>}
    </Modal>}
    {detail && mode === 'move' && <Modal title={`Movimiento de ${detail.asset.name}`} onClose={close}>
      <form className="treasury-form" onSubmit={applyMovement}>
        <label>Operación<select value={moveType} onChange={event => { key.current = undefined; setMoveType(event.target.value as typeof moveType); }}><option value="in">Entrada</option><option value="out">Salida</option><option value="adjust">Ajuste por conteo</option></select></label>
        <p>Existencia actual: {detail.asset.quantity}</p>
        <label>{moveType === 'adjust' ? 'Nueva existencia' : 'Cantidad'}<input type="number" required min={moveType === 'adjust' ? 0 : 1} max="1000000000" value={moveQuantity} onChange={event => { key.current = undefined; setMoveQuantity(event.target.value); }} /></label>
        <label>Motivo<textarea required minLength={5} maxLength={500} value={reason} onChange={event => { key.current = undefined; setReason(event.target.value); }} /></label>
        <ErrorBox error={error} /><button className="primary" disabled={busy}>Confirmar movimiento</button>
      </form>
    </Modal>}
    {detail && mode === 'retire' && <Modal title={`Dar de baja ${detail.asset.name}`} onClose={close}>
      <form className="treasury-form" onSubmit={retire}>
        {detail.asset.type === 'movable' && <p>La existencia debe quedar en cero antes de la baja.</p>}
        <label>Motivo de la baja<textarea required minLength={5} maxLength={500} value={reason} onChange={event => { key.current = undefined; setReason(event.target.value); }} /></label>
        <ErrorBox error={error} /><button className="primary" disabled={busy}>Confirmar baja</button>
      </form>
    </Modal>}
  </>;
}
