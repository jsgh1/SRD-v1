import { useEffect, useState } from 'react';
import { api } from './api';
import { ErrorBox, Loading } from './ui';
import { t } from './i18n';
export type PositionCatalog = { version: number; items: { code: string; label: string; label_en?: string; active: boolean }[] };

export function PersonPositionSettings() {
  const [catalog, setCatalog] = useState<PositionCatalog>(), [draft, setDraft] = useState<PositionCatalog['items']>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [saved, setSaved] = useState(false);
  async function load() {
    setBusy(true); setError(undefined); setSaved(false);
    try { const value = await api<PositionCatalog>('person-positions'); setCatalog(value); setDraft(value.items); }
    catch (e) { setError(e); } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  return <section className="panel position-settings" aria-label={t('Catálogo de cargos')}>
    <h2>{t('Cargos de las personas')}</h2>
    <p className="muted">{t('Hasta 50 cargos por junta. Puedes renombrarlos o desactivarlos. Las fichas conservan el nombre registrado; un cargo no concede permisos de acceso.')}</p>
    <ErrorBox error={error} />{saved && <p role="status">{t('Cargos guardados.')}</p>}
    {!catalog && busy && <Loading />}
    {catalog && <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError(undefined); setSaved(false);
      try { const value = await api<PositionCatalog>('person-positions', 'PUT', { version: catalog.version, items: draft }); setCatalog(value); setDraft(value.items); setSaved(true); }
      catch (e) { setError(e); } finally { setBusy(false); }
    }}><fieldset disabled={busy} className="field-settings-group">
      {draft.map((item, index) => <div className="custom-option" key={item.code}>
        <label>{t('Cargo {number}', {number: index + 1})}<input required maxLength={80} value={item.label} onChange={e => { setSaved(false); setDraft(draft.map(i => i.code === item.code ? { ...i, label: e.target.value, label_en: '' } : i)); }} /></label>
        <label>{t('Cargo {number} en inglés', {number: index + 1})}<input required maxLength={80} value={item.label_en ?? ''} onChange={e => { setSaved(false); setDraft(draft.map(i => i.code === item.code ? { ...i, label_en: e.target.value } : i)); }} /></label>
        <label className="inline"><input type="checkbox" aria-label={t('Cargo {number} activo', {number: index + 1})} checked={item.active} onChange={e => { setSaved(false); setDraft(draft.map(i => i.code === item.code ? { ...i, active: e.target.checked } : i)); }} />{t('Activo')}</label>
        {!catalog.items.some(i => i.code === item.code) && <button type="button" onClick={() => { setSaved(false); setDraft(draft.filter(i => i.code !== item.code)); }}>{t('Retirar cargo {number}', {number: index + 1})}</button>}
      </div>)}
      <div className="actions"><button type="button" disabled={draft.length >= 50} onClick={() => { setSaved(false); setDraft([...draft, { code: crypto.randomUUID(), label: '', label_en: '', active: true }]); }}>{t('Agregar cargo')}</button><button className="primary">{t('Guardar cargos')}</button></div>
    </fieldset></form>}
    <button type="button" disabled={busy} onClick={load}>{t('Descartar cambios y recargar cargos')}</button>
  </section>;
}
