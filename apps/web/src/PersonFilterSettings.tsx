import { useEffect, useState } from 'react';
import { api, roleNames } from './api';
import { ErrorBox, Loading } from './ui';
import type { FieldSchema } from './PersonFields';
import { localizedLabel, t, useLanguage } from './i18n';

export type FilterSettings = { version: number; base: string[]; custom: string[] | null; delegated_roles: string[]; can_manage: boolean; can_delegate: boolean };
const baseLabels: Record<string,string> = { status:'Estado',zone:'Zona',affiliated:'Afiliación',document_type:'Tipo de documento',gender:'Género',descriptive_role:'Rol descriptivo',position_code:'Cargo',birth_date:'Intervalo de nacimiento',registered_at:'Intervalo de registro' };
export function PersonFilterSettings() {
  useLanguage();
  const [settings,setSettings]=useState<FilterSettings>(), [schema,setSchema]=useState<FieldSchema>();
  const [base,setBase]=useState<string[]>([]), [custom,setCustom]=useState<string[]>([]), [roles,setRoles]=useState<string[]>([]);
  const [busy,setBusy]=useState(false), [error,setError]=useState<unknown>(), [saved,setSaved]=useState(false);
  async function load() {
    setBusy(true); setError(undefined); setSaved(false);
    try {
      const [value,fields]=await Promise.all([api<FilterSettings>('person-filter-settings'),api<FieldSchema>('person-fields')]);
      setSettings(value); setSchema(fields); setBase(value.base); setCustom(value.custom ?? fields.fields.map(f=>f.id)); setRoles(value.delegated_roles);
    } catch(e) { setError(e); } finally { setBusy(false); }
  }
  useEffect(()=>{ void load(); },[]);
  const toggle=(values:string[],id:string)=>values.includes(id)?values.filter(v=>v!==id):[...values,id];
  if(settings && !settings.can_manage) return null;
  return <section className="panel filter-settings" aria-label={t('Configuración de filtros de personas')}>
    <h2>{t('Filtros visibles de personas')}</h2>
    <p className="muted">{t('Elige los filtros que verá toda la junta en Lista. La búsqueda por nombre o documento siempre está disponible. Esto no oculta datos de las fichas ni cambia permisos de consulta.')}</p>
    <ErrorBox error={error}/>{saved && <p role="status">{t('Filtros guardados. Se aplicarán al volver a abrir Lista.')}</p>}
    {!settings && busy && <Loading/>}
    {settings && schema && <form onSubmit={async e=>{
      e.preventDefault(); setBusy(true); setError(undefined); setSaved(false);
      try {
        const value=await api<FilterSettings>('person-filter-settings','PUT',{version:settings.version,base,custom,...(settings.can_delegate?{delegated_roles:roles}:{})});
        setSettings(value); setSaved(true);
      } catch(e) { setError(e); } finally { setBusy(false); }
    }}><fieldset disabled={busy} className="field-settings-group"><legend>{t('Mostrar en Lista')}</legend>
      {Object.entries(baseLabels).map(([key,label])=><label className="inline" key={key}><input type="checkbox" checked={base.includes(key)} onChange={()=>{setSaved(false);setBase(toggle(base,key));}}/>{t(label)}</label>)}
      <h3>{t('Campos adicionales')}</h3>
      {schema.fields.length ? schema.fields.map(field=><label className="inline" key={field.id}><input type="checkbox" checked={custom.includes(field.id)} onChange={()=>{setSaved(false);setCustom(toggle(custom,field.id));}}/>{localizedLabel(field)}{field.active?'':` ${t('(inactivo)')}`}</label>) : <p>{t('No hay campos adicionales configurados.')}</p>}
      <p className="muted">{t('Tras guardar esta selección, los campos nuevos se mostrarán como filtros cuando los selecciones aquí. Se mantienen hasta tres criterios adicionales por búsqueda.')}</p>
      {settings.can_delegate && <><h3>{t('Quién puede editar esta selección')}</h3><p>{t('Administradores y superadministradores siempre pueden editarla. Los roles delegados cambian los filtros comunes, pero no pueden conceder delegaciones.')}</p>
        {['registrar','treasurer','auditor','viewer'].map(role=><label className="inline" key={role}><input type="checkbox" checked={roles.includes(role)} onChange={()=>{setSaved(false);setRoles(toggle(roles,role));}}/>{t('Permitir a {role}', {role: t(roleNames[role])})}</label>)}
      </>}
      <button className="primary">{t('Guardar filtros visibles')}</button>
    </fieldset></form>}
    <button type="button" disabled={busy} onClick={()=>void load()}>{t('Descartar cambios y recargar filtros')}</button>
  </section>;
}
