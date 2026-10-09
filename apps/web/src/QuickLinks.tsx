import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, ClipboardList, Download, Search, Settings, UserPlus, Users } from 'lucide-react';
import { api, canAdmin, type Principal } from './api';
import { ErrorBox, Loading } from './ui';
import { localizedLabel, t, translateToEnglish } from './i18n';

type Item = { function: string; label: string; label_en?: string };
type Configuration = {
  mode: 'common' | 'personal'; common_version: number; personal_version: number;
  inherited: boolean; items: Item[]; personal_items: Item[] | null;
  common_items?: Item[]; catalog: Item[];
};
const icons: Record<string, typeof Users> = { register: UserPlus, list: Users, lookup: Search, settings: Settings, audit: ClipboardList, downloads: Download };

export function QuickLinks({ navigate }: { navigate: (page: string) => void }) {
  const [data, setData] = useState<Configuration>();
  const [error, setError] = useState<unknown>();
  useEffect(() => { api<Configuration>('quick-links').then(setData).catch(setError); }, []);
  return <>
    <ErrorBox error={error} />
    {!data && !error && <Loading />}
    <div className="quick-links" aria-label={t('Accesos rápidos')}>
      {data?.items.map(item => {
        const Icon = icons[item.function];
        return Icon && <button key={item.function} onClick={() => navigate(item.function)}><Icon size={19} />{item.label_en ? localizedLabel(item) : t(item.label)}<ArrowUpRight size={16} /></button>;
      })}
    </div>
  </>;
}

export function QuickLinkSettings({ principal }: { principal: Principal }) {
  const [data, setData] = useState<Configuration>();
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true); setError(undefined);
    try { setData(await api<Configuration>('quick-links')); } catch (e) { setError(e); } finally { setBusy(false); }
  }
  useEffect(() => { refresh(); }, []);
  async function save(scope: string, body: object) {
    setBusy(true); setError(undefined); setNotice('');
    try {
      setData(await api<Configuration>(`quick-links/${scope}`, 'PATCH', body));
      setNotice(t('Accesos rápidos guardados. Los verás al volver a Home.'));
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return <section className="panel">
    <h2>{t('Accesos rápidos del panel')}</h2>
    <p>{t('Elige hasta tres funciones y sus etiquetas. Retirar un acceso no elimina la función del menú.')}</p>
    <ErrorBox error={error} />
    {notice && <p className="notice" role="status">{notice}</p>}
    {!data ? !error && <Loading /> : <>
      {canAdmin(principal.role) && <Editor key={`common-${data.common_version}`} common canSetPolicy={principal.role === 'superadmin'} data={data} busy={busy} save={save} />}
      {data.mode === 'personal' ? <Editor key={`personal-${data.personal_version}-${data.common_version}`} data={data} busy={busy} save={save} /> : <p className="muted">{t('La junta usa una configuración común. Cada persona ve únicamente las funciones que permite su rol.')}</p>}
    </>}
    <button type="button" onClick={refresh} disabled={busy}>{t('Recargar accesos')}</button>
  </section>;
}

function Editor({ data, common = false, canSetPolicy = false, busy, save }: { data: Configuration; common?: boolean; canSetPolicy?: boolean; busy: boolean; save: (scope: string, body: object) => Promise<void> }) {
  const [items, setItems] = useState<Item[]>(() => {
    const initial = common ? data.common_items || [] : data.personal_items ?? data.items;
    return Array.from({ length: 3 }, (_, i) => initial[i]
      ? { ...initial[i], label_en: initial[i].label_en ?? (data.catalog.some(item => item.function === initial[i].function && item.label === initial[i].label) ? translateToEnglish(initial[i].label) : '') }
      : { function: '', label: '', label_en: '' });
  });
  const [mode, setMode] = useState(data.mode);
  const [inherit, setInherit] = useState(data.inherited);
  const prefix = common ? 'Común' : 'Personal';
  function change(index: number, patch: Partial<Item>) { setItems(current => current.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await save(common ? 'organization' : 'personal', {
      items: !common && inherit ? [] : items.filter(item => item.function),
      version: common ? data.common_version : data.personal_version,
      ...(common ? (canSetPolicy ? { mode } : {}) : { inherit, common_version: data.common_version }),
    });
  }
  return <form onSubmit={submit} className="quick-link-editor">
    <h3>{t(common ? 'Configuración de la junta' : 'Mis accesos rápidos')}</h3>
    {common ? canSetPolicy ? <label>{t('Modo de accesos rápidos')}<select value={mode} onChange={e => setMode(e.target.value as Configuration['mode'])} disabled={busy}>
      <option value="common">{t('Configuración común para la junta')}</option><option value="personal">{t('Permitir personalización por usuario')}</option>
    </select></label> : <p>{t('Política vigente: {mode}. Solo el superadministrador puede cambiarla.', {mode: t(data.mode === 'personal' ? 'personalización por usuario' : 'configuración común')})}</p> : <label className="check-row"><input type="checkbox" checked={inherit} onChange={e => setInherit(e.target.checked)} disabled={busy} />{t('Usar los accesos de la junta')}</label>}
    <fieldset disabled={busy || (!common && inherit)}>
      <legend>{t(common ? 'Accesos comunes y predeterminados' : 'Selecciona tus accesos')}</legend>
      {items.map((item, index) => <div className="form-grid" key={index}>
        <label>{t('{scope} · Función {number}', {scope: t(prefix), number: index + 1})}<select value={item.function} onChange={e => { const label = data.catalog.find(f => f.function === e.target.value)?.label || ''; change(index, { function: e.target.value, label, label_en: translateToEnglish(label) }); }}>
          <option value="">{t('Sin acceso')}</option>
          {data.catalog.map(option => <option key={option.function} value={option.function} disabled={items.some((other, i) => i !== index && other.function === option.function)}>{t(option.label)}</option>)}
        </select></label>
        <label>{t('{scope} · Etiqueta {number}', {scope: t(prefix), number: index + 1})}<input value={item.label} required={!!item.function} maxLength={40} disabled={!item.function} onChange={e => change(index, { label: e.target.value, label_en: '' })} /></label>
        <label>{t('{scope} · Etiqueta en inglés {number}', {scope: t(prefix), number: index + 1})}<input value={item.label_en ?? ''} required={!!item.function} maxLength={40} disabled={!item.function} onChange={e => change(index, { label_en: e.target.value })} /></label>
      </div>)}
    </fieldset>
    <button className="primary" disabled={busy}>{t(common ? 'Guardar accesos de la junta' : 'Guardar mis accesos')}</button>
  </form>;
}
