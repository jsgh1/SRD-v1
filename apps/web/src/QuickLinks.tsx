import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, ClipboardList, Download, Search, Settings, UserPlus, Users } from 'lucide-react';
import { api, canAdmin, type Principal } from './api';
import { ErrorBox, Loading } from './ui';

type Item = { function: string; label: string };
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
    <div className="quick-links" aria-label="Accesos rápidos">
      {data?.items.map(item => {
        const Icon = icons[item.function];
        return Icon && <button key={item.function} onClick={() => navigate(item.function)}><Icon size={19} />{item.label}<ArrowUpRight size={16} /></button>;
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
      setNotice('Accesos rápidos guardados. Los verás al volver a Home.');
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return <section className="panel">
    <h2>Accesos rápidos del panel</h2>
    <p>Elige hasta tres funciones y sus etiquetas. Retirar un acceso no elimina la función del menú.</p>
    <ErrorBox error={error} />
    {notice && <p className="notice" role="status">{notice}</p>}
    {!data ? !error && <Loading /> : <>
      {canAdmin(principal.role) && <Editor key={`common-${data.common_version}`} common canSetPolicy={principal.role === 'superadmin'} data={data} busy={busy} save={save} />}
      {data.mode === 'personal' ? <Editor key={`personal-${data.personal_version}-${data.common_version}`} data={data} busy={busy} save={save} /> : <p className="muted">La junta usa una configuración común. Cada persona ve únicamente las funciones que permite su rol.</p>}
    </>}
    <button type="button" onClick={refresh} disabled={busy}>Recargar accesos</button>
  </section>;
}

function Editor({ data, common = false, canSetPolicy = false, busy, save }: { data: Configuration; common?: boolean; canSetPolicy?: boolean; busy: boolean; save: (scope: string, body: object) => Promise<void> }) {
  const [items, setItems] = useState<Item[]>(() => {
    const initial = common ? data.common_items || [] : data.personal_items ?? data.items;
    return Array.from({ length: 3 }, (_, i) => initial[i] || { function: '', label: '' });
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
    <h3>{common ? 'Configuración de la junta' : 'Mis accesos rápidos'}</h3>
    {common ? canSetPolicy ? <label>Modo de accesos rápidos<select value={mode} onChange={e => setMode(e.target.value as Configuration['mode'])} disabled={busy}>
      <option value="common">Configuración común para la junta</option><option value="personal">Permitir personalización por usuario</option>
    </select></label> : <p>Política vigente: {data.mode === 'personal' ? 'personalización por usuario' : 'configuración común'}. Solo el superadministrador puede cambiarla.</p> : <label className="check-row"><input type="checkbox" checked={inherit} onChange={e => setInherit(e.target.checked)} disabled={busy} />Usar los accesos de la junta</label>}
    <fieldset disabled={busy || (!common && inherit)}>
      <legend>{common ? 'Accesos comunes y predeterminados' : 'Selecciona tus accesos'}</legend>
      {items.map((item, index) => <div className="form-grid" key={index}>
        <label>{prefix} · Función {index + 1}<select value={item.function} onChange={e => change(index, { function: e.target.value, label: data.catalog.find(f => f.function === e.target.value)?.label || '' })}>
          <option value="">Sin acceso</option>
          {data.catalog.map(option => <option key={option.function} value={option.function} disabled={items.some((other, i) => i !== index && other.function === option.function)}>{option.label}</option>)}
        </select></label>
        <label>{prefix} · Etiqueta {index + 1}<input value={item.label} required={!!item.function} maxLength={40} disabled={!item.function} onChange={e => change(index, { label: e.target.value })} /></label>
      </div>)}
    </fieldset>
    <button className="primary" disabled={busy}>{common ? 'Guardar accesos de la junta' : 'Guardar mis accesos'}</button>
  </form>;
}
