import { useEffect, useState } from 'react';
import { api, roleNames } from './api';
import { ErrorBox, Loading } from './ui';
import { planillaColumns, type PlanillaConfiguration } from './planillaColumns';

export function PlanillaSettings({ organizationName }: { organizationName: string }) {
  const [settings, setSettings] = useState<PlanillaConfiguration>();
  const [columns, setColumns] = useState<string[]>([]);
  const [h1, setH1] = useState('');
  const [h2, setH2] = useState('');
  const [h3, setH3] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setBusy(true); setError(undefined); setSaved(false);
    api<PlanillaConfiguration>('planilla-settings').then(value => {
      if (!active) return;
      setSettings(value); setColumns(value.allowed_columns);
      setH1(value.h1); setH2(value.h2 || organizationName); setH3(value.h3);
      setRoles(value.delegated_roles);
    }).catch(value => { if (active) setError(value); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [organizationName, revision]);

  const toggle = (values: string[], key: string) => values.includes(key)
    ? values.filter(value => value !== key) : [...values, key];
  if (settings && !settings.can_manage) return null;
  return <section className="panel" aria-label="Configuración de planilla">
    <h2>Planilla de firmas</h2>
    <p className="muted">Define los encabezados iniciales y qué columnas adicionales puede elegir la junta. Las cinco columnas obligatorias y el límite de cinco adicionales no cambian.</p>
    <ErrorBox error={error} />
    {saved && <p role="status">Configuración de planilla guardada. Se aplicará al volver a abrir Lista.</p>}
    {!settings && busy && <Loading />}
    {settings && <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(undefined); setSaved(false);
      try {
        const value = await api<PlanillaConfiguration>('planilla-settings', 'PUT', {
          version: settings.version, allowed_columns: columns, h1, h2, h3,
          ...(settings.can_delegate ? { delegated_roles: roles } : {}),
        });
        setSettings(value); setSaved(true);
      } catch (value) { setError(value); }
      finally { setBusy(false); }
    }}><fieldset disabled={busy} className="field-settings-group">
      <legend>Composición y columnas disponibles</legend>
      <div className="form-grid">
        <label>H1 de la planilla<input required maxLength={120} value={h1} onChange={event => { setSaved(false); setH1(event.target.value); }} /></label>
        <label>H2 de la planilla<input required maxLength={120} value={h2} onChange={event => { setSaved(false); setH2(event.target.value); }} /></label>
        <label>H3 de la planilla<input required maxLength={120} value={h3} onChange={event => { setSaved(false); setH3(event.target.value); }} /></label>
      </div>
      <h3>Columnas adicionales disponibles</h3>
      {planillaColumns.map(([key, label]) => <label className="inline" key={key}>
        <input type="checkbox" checked={columns.includes(key)} onChange={() => { setSaved(false); setColumns(toggle(columns, key)); }} />{label}
      </label>)}
      <p className="muted">Puedes ofrecer las ocho opciones; cada planilla concreta admite hasta cinco. La selección se verifica también en el servidor.</p>
      {settings.can_delegate && <><h3>Quién puede editar esta configuración</h3>
        <p>Superadministradores y administradores siempre pueden editarla. Los roles delegados no pueden conceder permisos a otros.</p>
        {['registrar', 'treasurer', 'auditor', 'viewer'].map(role => <label className="inline" key={role}>
          <input type="checkbox" checked={roles.includes(role)} onChange={() => { setSaved(false); setRoles(toggle(roles, role)); }} />Permitir a {roleNames[role]}
        </label>)}
      </>}
      <button className="primary">Guardar configuración de planilla</button>
    </fieldset></form>}
    <button type="button" disabled={busy} onClick={() => setRevision(value => value + 1)}>Descartar cambios y recargar planilla</button>
  </section>;
}
