import { useEffect, useState } from 'react';
import { api, roleNames } from './api';
import { ErrorBox, Loading } from './ui';
import { planillaColumns, type PlanillaConfiguration } from './planillaColumns';
import { t, useLanguage } from './i18n';

export function PlanillaSettings({ organizationName }: { organizationName: string }) {
  useLanguage();
  const [settings, setSettings] = useState<PlanillaConfiguration>();
  const [columns, setColumns] = useState<string[]>([]);
  const [h1, setH1] = useState('');
  const [h2, setH2] = useState('');
  const [h3, setH3] = useState('');
  const [h1En, setH1En] = useState('');
  const [h2En, setH2En] = useState('');
  const [h3En, setH3En] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
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
      setH1En(value.h1_en ?? ''); setH2En(value.h2_en ?? (value.version === 0 ? organizationName : '')); setH3En(value.h3_en ?? '');
      setRoles(value.delegated_roles);
      setLogo(value.logo_data);
    }).catch(value => { if (active) setError(value); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [organizationName, revision]);

  const toggle = (values: string[], key: string) => values.includes(key)
    ? values.filter(value => value !== key) : [...values, key];
  if (settings && !settings.can_manage) return null;
  return <section className="panel" aria-label={t('Configuración de planilla')}>
    <h2>{t('Planilla de firmas')}</h2>
    <p className="muted">{t('Define los encabezados iniciales y qué columnas adicionales puede elegir la junta. Las cinco columnas obligatorias y el límite de cinco adicionales no cambian.')}</p>
    <ErrorBox error={error} />
    {saved && <p role="status">{t('Configuración de planilla guardada. Se aplicará al volver a abrir Lista.')}</p>}
    {!settings && busy && <Loading />}
    {settings && <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(undefined); setSaved(false);
      try {
        const value = await api<PlanillaConfiguration>('planilla-settings', 'PUT', {
          version: settings.version, allowed_columns: columns, h1, h2, h3,
          h1_en: h1En, h2_en: h2En, h3_en: h3En,
          logo_data: logo,
          ...(settings.can_delegate ? { delegated_roles: roles } : {}),
        });
        setSettings(value); setSaved(true);
        window.dispatchEvent(new Event('srd-planilla-logo-updated'));
      } catch (value) { setError(value); }
      finally { setBusy(false); }
    }}><fieldset disabled={busy} className="field-settings-group">
      <legend>{t('Composición y columnas disponibles')}</legend>
      <div className="planilla-logo-settings">
        <p className="muted">{t('El logo se mostrará en el acceso público de esta junta, el encabezado y la planilla.')}</p>
        <label>{t('Logo de la junta para la planilla (PNG, máximo 128 KB)')}
          <input type="file" accept="image/png" onChange={async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            setSaved(false); setError(undefined);
            if (file.type !== 'image/png' || file.size > 131072) {
              setError(new Error(t('El logo debe ser PNG de hasta 128 KB y 1024 × 1024 píxeles.')));
              event.target.value = '';
              return;
            }
            try {
              const value = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
              });
              const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve({ width: image.width, height: image.height });
                image.onerror = () => reject(new Error(t('No se pudo leer el logo PNG.')));
                image.src = value;
              });
              if (dimensions.width > 1024 || dimensions.height > 1024) throw new Error(t('El logo debe ser PNG de hasta 128 KB y 1024 × 1024 píxeles.'));
              setLogo(value);
            } catch (value) { setError(value); }
            event.target.value = '';
          }} />
        </label>
        {logo && <div className="planilla-logo-preview"><img src={logo} alt={t('Vista previa del logo de la junta')} /><button type="button" onClick={() => { setLogo(null); setSaved(false); }}>{t('Quitar logo')}</button></div>}
      </div>
      <div className="form-grid">
        <label>{t('H1 de la planilla')}<input required maxLength={120} value={h1} onChange={event => { setSaved(false); setH1(event.target.value); setH1En(''); }} /></label>
        <label>{t('H1 de la planilla en inglés')}<input required maxLength={120} value={h1En} onChange={event => { setSaved(false); setH1En(event.target.value); }} /></label>
        <label>{t('H2 de la planilla')}<input required maxLength={120} value={h2} onChange={event => { setSaved(false); setH2(event.target.value); setH2En(''); }} /></label>
        <label>{t('H2 de la planilla en inglés')}<input required maxLength={120} value={h2En} onChange={event => { setSaved(false); setH2En(event.target.value); }} /></label>
        <label>{t('H3 de la planilla')}<input required maxLength={120} value={h3} onChange={event => { setSaved(false); setH3(event.target.value); setH3En(''); }} /></label>
        <label>{t('H3 de la planilla en inglés')}<input required maxLength={120} value={h3En} onChange={event => { setSaved(false); setH3En(event.target.value); }} /></label>
      </div>
      <h3>{t('Columnas adicionales disponibles')}</h3>
      {planillaColumns.map(([key, label]) => <label className="inline" key={key}>
        <input type="checkbox" checked={columns.includes(key)} onChange={() => { setSaved(false); setColumns(toggle(columns, key)); }} />{t(label)}
      </label>)}
      <p className="muted">{t('Puedes ofrecer las ocho opciones; cada planilla concreta admite hasta cinco. La selección se verifica también en el servidor.')}</p>
      {settings.can_delegate && <><h3>{t('Quién puede editar esta configuración')}</h3>
        <p>{t('Superadministradores y administradores siempre pueden editarla. Los roles delegados no pueden conceder permisos a otros.')}</p>
        {['registrar', 'treasurer', 'auditor', 'viewer'].map(role => <label className="inline" key={role}>
          <input type="checkbox" checked={roles.includes(role)} onChange={() => { setSaved(false); setRoles(toggle(roles, role)); }} />{t('Permitir a {role}', {role: t(roleNames[role])})}
        </label>)}
      </>}
      <button className="primary">{t('Guardar configuración de planilla')}</button>
    </fieldset></form>}
    <button type="button" disabled={busy} onClick={() => setRevision(value => value + 1)}>{t('Descartar cambios y recargar planilla')}</button>
  </section>;
}
