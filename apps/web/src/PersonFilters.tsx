import { useEffect, useState } from 'react';
import { api } from './api';
import { ErrorBox, Loading } from './ui';
import type { FieldSchema } from './PersonFields';
export type ExtraFilter = { field_id: string; value: string; operator?: 'eq' | 'between'; value_to?: string };

export function PersonFilters({ value, onChange, allowed = null }: { value: ExtraFilter[]; onChange: (value: ExtraFilter[]) => void; allowed?: string[] | null }) {
  const [schema, setSchema] = useState<FieldSchema>(), [error, setError] = useState<unknown>();
  useEffect(() => { let active = true; api<FieldSchema>('person-fields').then(result => { if (active) setSchema(result); }).catch(e => { if (active) setError(e); }); return () => { active = false; }; }, []);
  if (error) return <div className="person-extra-filters"><ErrorBox error={error} /><p>No se pudo cargar el catálogo de filtros adicionales. Recarga la página para intentarlo de nuevo.</p></div>;
  if (!schema) return <Loading />;
  const fields = schema.fields.filter(field => allowed === null || allowed.includes(field.id));
  if (!fields.length) return null;
  return <fieldset className="person-extra-filters"><legend>Filtros por campos adicionales</legend>
    <p className="muted">Hasta tres criterios combinados; todos deben coincidir. Las fechas permiten coincidencia exacta o intervalo inclusivo. También puedes consultar campos y opciones inactivos. En números, 1 y 1.0 son valores de texto distintos; los valores exactos admiten hasta 120 caracteres.</p>
    {value.map((filter, index) => {
      const field = fields.find(item => item.id === filter.field_id);
      const change = (patch: Partial<ExtraFilter>) => onChange(value.map((item, i) => i === index ? { ...item, ...patch } : item));
      return <div className="person-extra-filter" key={index}>
        <label>Campo adicional {index + 1}<select value={filter.field_id} onChange={e => change({ field_id: e.target.value, value: '', operator: 'eq', value_to: undefined })}>
          {fields.filter(item => item.id === filter.field_id || !value.some(v => v.field_id === item.id)).map(item => <option key={item.id} value={item.id}>{item.label}{item.active ? '' : ' (inactivo)'}</option>)}
        </select></label>
        {field?.type === 'date' && <label>Comparación del filtro {index + 1}<select value={filter.operator ?? 'eq'} onChange={e=>change({operator:e.target.value as 'eq' | 'between',value_to:undefined})}><option value="eq">Fecha exacta</option><option value="between">Entre dos fechas</option></select></label>}
        <label>{filter.operator === 'between' ? `Desde (filtro ${index + 1})` : `Valor del filtro ${index + 1}`}{field?.type === 'select' ? <select required value={filter.value} onChange={e => change({ value: e.target.value })}><option value="">Seleccionar</option>{field.options.map(option => <option key={option.id} value={option.id}>{option.label}{option.active ? '' : ' (inactiva)'}</option>)}</select>
          : <input required type={field?.type === 'date' ? 'date' : 'text'} maxLength={120} value={filter.value} placeholder="Coincidencia exacta" onChange={e => change({ value: e.target.value })} />}</label>
        {field?.type === 'date' && filter.operator === 'between' && <label>Hasta (filtro {index + 1})<input required type="date" min={filter.value || undefined} value={filter.value_to ?? ''} onChange={e=>change({value_to:e.target.value})}/></label>}
        <button type="button" onClick={() => onChange(value.filter((_, i) => i !== index))}>Quitar filtro {index + 1}</button>
      </div>;
    })}
    <button type="button" disabled={value.length >= 3 || value.length >= fields.length} onClick={() => {
      const field = fields.find(item => !value.some(v => v.field_id === item.id));
      if (field) onChange([...value, { field_id: field.id, value: '' }]);
    }}>Agregar filtro adicional</button>
  </fieldset>;
}
