import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Folder, FolderPlus } from 'lucide-react';
import { api, ApiError } from './api';
import { Empty, ErrorBox, Loading, Modal } from './ui';
import { FolderDocuments } from './FolderDocuments';
import { t, useLanguage, type Language } from './i18n';

type FolderItem = { id: string; name: string; name_en?: string | null; version: number };
type Listing = { items: FolderItem[]; total: number; page_size: number; breadcrumbs: Pick<FolderItem, 'id' | 'name' | 'name_en'>[] };
type Editor = { id: string; name: string; name_en: string; version?: number; parent?: string };
const folderName = (item: Pick<FolderItem, 'name' | 'name_en'>, language: Language) => language === 'en' && item.name_en ? item.name_en : item.name;

export function Folders({canManage,initialFolder}:{canManage:boolean;initialFolder?:string}) {
  const language = useLanguage();
  const [parent, setParent] = useState<string|undefined>(initialFolder), [page, setPage] = useState(1);
  const [listing, setListing] = useState<Listing>(), [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(), [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<Editor>(), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState<unknown>();
  const [moving, setMoving] = useState<FolderItem>();
  const [removing, setRemoving] = useState<FolderItem>(), [status, setStatus] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setListing(undefined); setError(undefined);
    const query = new URLSearchParams({ page: String(page) });
    if (parent) query.set('parent_id', parent);
    api<Listing>(`folders?${query}`).then(data => {
      if (!active) return;
      const last = Math.max(1, Math.ceil(data.total / data.page_size));
      if (page > last) { setPage(last); return; }
      setListing(data);
    })
      .catch(err => { if (active) setError(err); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [parent, page, revision]);
  function navigate(id?: string) { setParent(id); setPage(1); }
  function edit(item?: FolderItem) {
    setSaveError(undefined);
    setEditor(item ? { ...item, name_en: item.name_en || '' } : { id: crypto.randomUUID(), name: '', name_en: '', parent });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || saving) return;
    setSaving(true); setSaveError(undefined);
    try {
      await api(editor.version ? `folders/${editor.id}` : 'folders', editor.version ? 'PATCH' : 'POST',
        editor.version ? { name: editor.name, name_en: editor.name_en, version: editor.version }
          : { id: editor.id, name: editor.name, name_en: editor.name_en, parent_id: editor.parent ?? null });
      setEditor(undefined); setRevision(value => value + 1);
    } catch (err) { setSaveError(err); }
    finally { setSaving(false); }
  }
  return <section>
    <header className="page-heading"><div><h1>{t('Carpeta')}</h1><p className="muted">{t('Organiza las carpetas internas de tu junta.')}</p></div>
      {canManage&&<button className="primary" type="button" disabled={loading || !!error} onClick={() => edit()}><FolderPlus size={18} /> {t('Nueva carpeta')}</button>}</header>
    <nav aria-label={t('Ruta de carpetas')} className="actions">
      <button type="button" onClick={() => navigate()} disabled={loading}>{t('Inicio')}</button>
      {listing?.breadcrumbs.map(item => <button type="button" key={item.id} onClick={() => navigate(item.id)}>{folderName(item, language)}</button>)}
    </nav>
    <ErrorBox error={error} />
    <p role="status">{t(status)}</p>
    <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>{t('Actualizar carpetas')}</button>
    {loading && <Loading />}
    {listing && <>
      <p>{t(listing.total === 1 ? '{count} carpeta en esta ubicación.' : '{count} carpetas en esta ubicación.', { count: listing.total })}</p>
      {listing.items.length === 0 ? <Empty title={t('No hay carpetas en esta ubicación')}>{t(canManage?'Puedes crear una carpeta para organizar el trabajo de la junta.':'Aún no hay carpetas disponibles.')}</Empty> :
        <div className="table-wrap"><table><thead><tr><th>{t('Nombre')}</th>{canManage&&<th>{t('Acciones')}</th>}</tr></thead><tbody>
          {listing.items.map(item => <tr key={item.id}><td><button type="button" onClick={() => navigate(item.id)}><Folder size={18} /> {folderName(item, language)}</button></td>
            {canManage&&<td><div className="actions"><button type="button" onClick={() => edit(item)} aria-label={t('Renombrar {name}', { name: folderName(item, language) })}>{t('Renombrar')}</button>
              <button type="button" onClick={() => setMoving(item)} aria-label={t('Mover {name}', { name: folderName(item, language) })}>{t('Mover')}</button>
              <button type="button" onClick={() => { setStatus(''); setRemoving(item); }} aria-label={t('Eliminar carpeta {name}', { name: folderName(item, language) })}>{t('Eliminar')}</button></div></td>}</tr>)}
        </tbody></table></div>}
      <div className="actions"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>{t('Anterior')}</button>
        <span>{t('Página {page} de {total}', { page, total: Math.max(1, Math.ceil(listing.total / listing.page_size)) })}</span>
        <button type="button" disabled={page * listing.page_size >= listing.total} onClick={() => setPage(value => value + 1)}>{t('Siguiente')}</button></div>
    </>}
    {!error && <FolderDocuments key={parent ?? 'root'} folder={parent} readOnly={!canManage} />}
    {editor && <Modal title={t(editor.version ? 'Renombrar carpeta' : 'Nueva carpeta')} onClose={() => { if (!saving) setEditor(undefined); }}>
      <form onSubmit={save}><p className="muted">{t('Escribe el nombre de la carpeta en español e inglés. Las carpetas antiguas necesitan su versión inglesa antes de guardarse desde la web.')}</p>
        <label>{t('Nombre de carpeta (ES)')}<input autoFocus required maxLength={120} value={editor.name} disabled={saving}
        onChange={event => setEditor({ ...editor, name: event.target.value })} /></label>
        <label>{t('Nombre de carpeta (EN)')}<input required maxLength={120} value={editor.name_en} disabled={saving}
          onChange={event => setEditor({ ...editor, name_en: event.target.value })} /></label>
        <ErrorBox error={saveError} /><div className="actions"><button type="button" disabled={saving} onClick={() => setEditor(undefined)}>{t('Cancelar')}</button>
          <button disabled={saving}>{t(saving ? 'Guardando…' : 'Guardar carpeta')}</button></div></form>
    </Modal>}
    {moving && <FolderMove item={moving} onClose={() => setMoving(undefined)} onMoved={() => { setMoving(undefined); setRevision(value => value + 1); }} />}
    {removing && <FolderDelete item={removing} onClose={() => setRemoving(undefined)}
      onRefresh={() => { setRemoving(undefined); setRevision(value => value + 1); }}
      onDeleted={() => { setRemoving(undefined); setStatus('Carpeta vacía eliminada.'); setRevision(value => value + 1); }} />}
  </section>;
}

function FolderDelete({ item, onClose, onRefresh, onDeleted }: { item: FolderItem; onClose: () => void; onRefresh: () => void; onDeleted: () => void }) {
  const language = useLanguage();
  const [confirmed, setConfirmed] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState<unknown>();
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function remove(event: FormEvent) {
    event.preventDefault(); if (!confirmed || saving) return;
    setSaving(true); setError(undefined);
    try { await api(`folders/${item.id}`, 'DELETE', { version: item.version, confirm: true }); if (active.current) onDeleted(); }
    catch (err) { if (active.current) setError(err); }
    finally { if (active.current) setSaving(false); }
  }
  return <Modal title={t('Eliminar carpeta: {name}', { name: folderName(item, language) })} onClose={() => { if (!saving) onClose(); }}>
    <form onSubmit={remove}><p>{t('Solo puedes eliminar una carpeta vacía. Esta acción no se puede deshacer.')}</p>
      <label className="check-label"><input type="checkbox" checked={confirmed} disabled={saving} onChange={event => setConfirmed(event.target.checked)} /> {t('Confirmo que quiero eliminar esta carpeta vacía.')}</label>
      <ErrorBox error={error} /><div className="actions"><button type="button" disabled={saving} onClick={onClose}>{t('Cancelar eliminación')}</button>
        {error instanceof ApiError && [404,409,422].includes(error.status) && <button type="button" disabled={saving} onClick={onRefresh}>{t('Actualizar carpetas y cerrar')}</button>}
        <button disabled={!confirmed || saving}>{t(saving ? 'Eliminando carpeta…' : 'Sí, eliminar')}</button></div>
    </form>
  </Modal>;
}

function FolderMove({ item, onClose, onMoved }: { item: FolderItem; onClose: () => void; onMoved: () => void }) {
  const language = useLanguage();
  const [parent, setParent] = useState<string>(), [page, setPage] = useState(1), [listing, setListing] = useState<Listing>();
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setListing(undefined); setError(undefined);
    const query = new URLSearchParams({ page: String(page) });
    if (parent) query.set('parent_id', parent);
    api<Listing>(`folders?${query}`).then(data => {
      if (!active) return;
      const last = Math.max(1, Math.ceil(data.total / data.page_size));
      if (page > last) { setPage(last); return; }
      setListing(data);
    })
      .catch(err => { if (active) setError(err); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [parent, page, revision]);
  function navigate(id?: string) { setParent(id); setPage(1); }
  async function move() {
    if (saving || loading || !listing) return;
    setSaving(true); setError(undefined);
    try { await api(`folders/${item.id}/move`, 'POST', { parent_id: parent ?? null, version: item.version }); onMoved(); }
    catch (err) { setError(err); }
    finally { setSaving(false); }
  }
  return <Modal title={t('Mover carpeta: {name}', { name: folderName(item, language) })} onClose={() => { if (!saving) onClose(); }}>
    <p>{t('Elige la carpeta de destino. Las subcarpetas se conservarán.')}</p>
    <nav className="actions" aria-label={t('Ruta de destino')}><button disabled={saving || loading} onClick={() => navigate()}>{t('Inicio del destino')}</button>
      {listing?.breadcrumbs.map(row => <button key={row.id} disabled={saving} onClick={() => navigate(row.id)}>{folderName(row, language)}</button>)}
    </nav>
    <ErrorBox error={error} />{loading && <Loading />}
    {listing && <><p>{t('Destino')}: {listing.breadcrumbs.map(row => folderName(row, language)).join(' / ') || t('Inicio')}</p>
      <div className="actions">{listing.items.filter(row => row.id !== item.id).map(row =>
        <button key={row.id} disabled={saving} onClick={() => navigate(row.id)} aria-label={t('Abrir destino {name}', { name: folderName(row, language) })}><Folder size={18} /> {folderName(row, language)}</button>)}</div>
      <div className="actions"><button disabled={saving || page === 1} onClick={() => setPage(value => value - 1)}>{t('Página anterior de destinos')}</button>
        <span>{t('Página {page}', { page })}</span><button disabled={saving || page * listing.page_size >= listing.total} onClick={() => setPage(value => value + 1)}>{t('Página siguiente de destinos')}</button></div>
    </>}
    <div className="actions"><button disabled={saving || loading} onClick={() => setRevision(value => value + 1)}>{t('Actualizar destinos')}</button>
      <button disabled={saving} onClick={onClose}>{t('Cancelar movimiento')}</button>
      <button className="primary" disabled={saving || loading || !listing} onClick={() => void move()}>{t(saving ? 'Moviendo…' : 'Mover a esta ubicación')}</button></div>
  </Modal>;
}
