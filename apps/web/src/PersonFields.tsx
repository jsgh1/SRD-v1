import { useEffect, useState } from 'react';
import { api, roleNames } from './api';
import { ErrorBox, Loading } from './ui';
import { localizedLabel, t } from './i18n';

type Option = { id: string; label: string; label_en?: string; active: boolean };
export type PersonField = { id: string; label: string; label_en?: string; type: 'text' | 'date' | 'number' | 'select'; active: boolean; required: boolean; options: Option[] };
export type FieldSchema = { version: number; fields: PersonField[]; delegated_roles?: string[]; can_manage?: boolean; can_delegate?: boolean };
export type FieldValues = Record<string, { value: string; display: string; display_en?: string; label: string; label_en?: string; type: string }>;
const types = { text: 'Texto', date: 'Fecha', number: 'Número decimal', select: 'Selección' };

export function PersonFieldSettings() {
  const [schema, setSchema] = useState<FieldSchema>(), [fields, setFields] = useState<PersonField[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  async function load() {
    setBusy(true); setError(undefined); setSaved(false);
    try { const result = await api<FieldSchema>('person-fields'); setSchema(result); setFields(result.fields); setRoles(result.delegated_roles ?? []); }
    catch (e) { setError(e); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  function change(index: number, patch: Partial<PersonField>) { setSaved(false); setFields(current => current.map((field, i) => i === index ? { ...field, ...patch } : field)); }
  function move(index: number, offset: number) { const next = [...fields]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; setFields(next); setSaved(false); }
  if (schema && !schema.can_manage) return null;
  return <section className="panel" aria-label={t('Configuración de campos adicionales')}>
    <h2>{t('Campos adicionales de personas')}</h2>
    <p className="muted">{t('Hasta 20 campos por junta, con 50 opciones por selección. El orden de esta lista será el del formulario. Los campos guardados conservan su tipo y se desactivan en lugar de eliminarse.')}</p>
    <p className="muted">{t('Sus valores serán visibles para quienes pueden consultar personas. Usa la nota interna para información restringida.')}</p>
    <ErrorBox error={error} />{saved && <p role="status">{t('Campos adicionales guardados.')}</p>}
    {!schema && busy && <Loading />}
    {schema && <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError(undefined); setSaved(false);
      try { const result = await api<FieldSchema>('person-fields', 'PUT', { version: schema.version, fields, ...(schema.can_delegate ? { delegated_roles: roles } : {}) }); setSchema(result); setFields(result.fields); setSaved(true); }
      catch (e) { setError(e); } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy} className="field-settings-group">
        {schema.can_delegate && <fieldset className="custom-field-card"><legend>{t('Quién puede editar campos adicionales')}</legend>
          <p>{t('Administradores y superadministradores siempre pueden editarlos. Los roles delegados pueden crear, ordenar y desactivar campos de toda la junta, pero no conceder delegaciones ni cambiar permisos de consulta.')}</p>
          {['registrar','treasurer','auditor','viewer'].map(role=><label className="inline" key={role}><input type="checkbox" checked={roles.includes(role)} onChange={()=>{setSaved(false);setRoles(roles.includes(role)?roles.filter(r=>r!==role):[...roles,role]);}}/>{t('Delegar campos a {role}', {role: t(roleNames[role])})}</label>)}
        </fieldset>}
        {fields.map((field, index) => {
          const stored = schema.fields.find(item => item.id === field.id);
          return <fieldset className="custom-field-card" key={field.id}>
            <legend>{t('Campo {number}', {number: index + 1})}</legend>
            <div className="form-grid">
              <label>{t('Etiqueta del campo')}<input required maxLength={80} value={field.label} onChange={e => change(index, { label: e.target.value, label_en: '' })} /></label>
              <label>{t('Etiqueta en inglés')}<input required maxLength={80} value={field.label_en ?? ''} onChange={e => change(index, { label_en: e.target.value })} /></label>
              <label>{t('Tipo del campo')}<select disabled={!!stored} value={field.type} onChange={e => change(index, { type: e.target.value as PersonField['type'], options: [] })}>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label>
              <label className="inline"><input type="checkbox" checked={field.active} onChange={e => change(index, { active: e.target.checked })} />{t('Campo activo')}</label>
              <label className="inline"><input type="checkbox" checked={field.required} onChange={e => change(index, { required: e.target.checked })} />{t('Obligatorio al completar')}</label>
            </div>
            {field.type === 'select' && <div className="custom-options">
              {field.options.map((option, optionIndex) => <div className="custom-option" key={option.id}>
                <label>{t('Opción {number}', {number: optionIndex + 1})}<input required maxLength={80} value={option.label} onChange={e => change(index, { options: field.options.map(o => o.id === option.id ? { ...o, label: e.target.value, label_en: '' } : o) })} /></label>
                <label>{t('Opción {number} en inglés', {number: optionIndex + 1})}<input required maxLength={80} value={option.label_en ?? ''} onChange={e => change(index, { options: field.options.map(o => o.id === option.id ? { ...o, label_en: e.target.value } : o) })} /></label>
                <label className="inline"><input type="checkbox" checked={option.active} onChange={e => change(index, { options: field.options.map(o => o.id === option.id ? { ...o, active: e.target.checked } : o) })} />{t('Opción {number} activa', {number: optionIndex + 1})}</label>
                {!stored?.options.some(o => o.id === option.id) && <button type="button" onClick={() => change(index, { options: field.options.filter(o => o.id !== option.id) })}>{t('Retirar opción {number}', {number: optionIndex + 1})}</button>}
              </div>)}
              <button type="button" disabled={field.options.length >= 50} onClick={() => change(index, { options: [...field.options, { id: crypto.randomUUID(), label: '', label_en: '', active: true }] })}>{t('Agregar opción')}</button>
            </div>}
            <div className="actions custom-field-actions">
              <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>{t('Subir campo {number}', {number: index + 1})}</button>
              <button type="button" disabled={index === fields.length - 1} onClick={() => move(index, 1)}>{t('Bajar campo {number}', {number: index + 1})}</button>
              {!stored && <button type="button" onClick={() => { setFields(fields.filter(f => f.id !== field.id)); setSaved(false); }}>{t('Retirar campo {number}', {number: index + 1})}</button>}
            </div>
          </fieldset>;
        })}
        <div className="actions custom-field-actions"><button type="button" disabled={fields.length >= 20} onClick={() => { setFields([...fields, { id: crypto.randomUUID(), label: '', label_en: '', type: 'text', active: true, required: false, options: [] }]); setSaved(false); }}>{t('Agregar campo')}</button>
          <button className="primary" type="submit">{t('Guardar campos adicionales')}</button></div>
      </fieldset>
    </form>}
    <button type="button" disabled={busy} onClick={load}>{t('Descartar cambios y recargar campos')}</button>
  </section>;
}

export function AdditionalInputs({ schema, previous = {}, complete }: { schema: FieldSchema; previous?: FieldValues; complete: boolean }) {
  if (!schema.fields.length) return null;
  return <section className="panel" aria-label={t('Campos adicionales del registro')}><h2>{t('Campos adicionales')}</h2>
    <p className="muted">{t('Los valores históricos conservan la etiqueta que tenían al guardarse. Las opciones inactivas solo pueden mantenerse en registros que ya las usaban.')}</p>
    <div className="form-grid">{schema.fields.map(field => {
      const historical = previous[field.id];
      if (!field.active) return historical ? <div key={field.id}><strong>{localizedLabel(historical)} {t('(inactivo)')}</strong><p>{localizedLabel({label: historical.display, label_en: historical.display_en})}</p></div> : null;
      const required = complete && field.required;
      const props = { name: `custom_${field.id}`, defaultValue: historical?.value || '', required };
      return <label key={field.id}>{localizedLabel(field)}{required ? ' *' : ''}
        {field.type === 'select' ? <select {...props}><option value="">{t('Seleccionar')}</option>
          {field.options.filter(option => option.active || option.id === historical?.value).map(option => <option key={option.id} value={option.id} disabled={!option.active}>{option.id === historical?.value ? localizedLabel({label: historical.display, label_en: historical.display_en}) : localizedLabel(option)}{!option.active ? ` ${t('(inactiva)')}` : ''}</option>)}
        </select> : <input {...props} type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} maxLength={field.type === 'text' ? 500 : undefined} step={field.type === 'number' ? '0.0001' : undefined} min={field.type === 'number' ? '-999999999999.9999' : undefined} max={field.type === 'number' ? '999999999999.9999' : undefined} />}
      </label>;
    })}</div>
  </section>;
}

export function AdditionalDetail({ values }: { values?: FieldValues }) {
  if (!values || !Object.keys(values).length) return null;
  return <section><h3>{t('Campos adicionales guardados')}</h3><dl className="details">{Object.entries(values).map(([id, value]) => <div key={id}><dt>{localizedLabel(value)}</dt><dd>{localizedLabel({label: value.display, label_en: value.display_en})}</dd></div>)}</dl></section>;
}
