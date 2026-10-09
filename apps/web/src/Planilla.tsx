import { useEffect, useState } from 'react';
import { api } from './api';
import { ErrorBox, Modal } from './ui';
import { ExportFilename, addExportFilename, exportFilenameReady, safeXlsxFilename, type ExportFilenameChoice } from './ExportFilename';
import { planillaColumns, type PlanillaConfiguration } from './planillaColumns';
import { showPlanillaPrint, type PlanillaPreview } from './PlanillaPrint';
import type { PlanillaPdfData } from './PlanillaPdf';
import { t, useLanguage } from './i18n';

type Workbook = { filename: string; mime: string; content: string; count: number };

export function Planilla({ applied, total, busy, organizationName }: { applied: string; total: number | undefined; busy: boolean; organizationName: string }) {
  const language = useLanguage();
  const [columns, setColumns] = useState<string[]>([]);
  const [name, setName] = useState<ExportFilenameChoice>({ name: '', confirmed: false });
  const [h1, setH1] = useState('JUNTA DE ACCIÓN COMUNAL');
  const [h2, setH2] = useState(organizationName);
  const [h3, setH3] = useState('PLANILLA DE FIRMAS');
  const [limitAlert, setLimitAlert] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [error, setError] = useState<unknown>();
  const [settings, setSettings] = useState<PlanillaConfiguration>();
  const [settingsError, setSettingsError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setSettings(undefined); setSettingsError(undefined); setColumns([]);
    api<PlanillaConfiguration>('planilla-settings').then(value => {
      if (!active) return;
      setSettings(value);
      setH1(language === 'en' ? (value.h1_en || value.h1) : value.h1);
      setH2(language === 'en' ? (value.h2_en || value.h2 || organizationName) : (value.h2 || organizationName));
      setH3(language === 'en' ? (value.h3_en || value.h3) : value.h3);
    }).catch(value => { if (active) setSettingsError(value); });
    return () => { active = false; };
  }, [organizationName, revision, language]);

  function toggle(column: string) {
    if (columns.includes(column)) setColumns(current => current.filter(item => item !== column));
    else if (columns.length === 5) setLimitAlert(true);
    else setColumns(current => [...current, column]);
  }

  async function download() {
    if (exporting) return;
    setExporting(true); setError(undefined);
    try {
      const params = new URLSearchParams(applied);
      params.set('language', language);
      columns.forEach((column, index) => params.set(`columns[${index}]`, column));
      params.set('h1', h1); params.set('h2', h2); params.set('h3', h3);
      addExportFilename(params, name);
      const file = await api<Workbook>(`persons/planilla?${params}`);
      if (!safeXlsxFilename(file.filename) || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        throw new Error(t('La planilla no tiene un formato válido.'));
      }
      const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { setError(value); }
    finally { setExporting(false); }
  }

  async function preview() {
    if (previewing) return;
    const popup = window.open('', '_blank');
    if (!popup) { setError(new Error(t('Permite abrir la vista imprimible en una ventana nueva.'))); return; }
    popup.opener = null;
    popup.document.title = t('Preparando planilla');
    popup.document.body.textContent = t('Preparando la vista imprimible…');
    setPreviewing(true); setError(undefined);
    try {
      const params = new URLSearchParams(applied);
      params.set('language', language);
      columns.forEach((column, index) => params.set(`columns[${index}]`, column));
      params.set('h1', h1); params.set('h2', h2); params.set('h3', h3);
      addExportFilename(params, name);
      const data = await api<PlanillaPreview>(`persons/planilla-preview?${params}`);
      if (popup.closed) return;
      showPlanillaPrint(popup, data);
    } catch (value) {
      popup.close(); setError(value);
    } finally { setPreviewing(false); }
  }

  async function downloadPdf() {
    if (pdfExporting) return;
    setPdfExporting(true); setError(undefined);
    try {
      const params = new URLSearchParams(applied);
      params.set('language', language);
      columns.forEach((column, index) => params.set(`columns[${index}]`, column));
      params.set('h1', h1); params.set('h2', h2); params.set('h3', h3);
      addExportFilename(params, name);
      const data = await api<PlanillaPdfData>(`persons/planilla-pdf?${params}`);
      const { downloadPlanillaPdf } = await import('./PlanillaPdf');
      await downloadPlanillaPdf(data);
    } catch (value) { setError(value); }
    finally { setPdfExporting(false); }
  }

  return <section className="panel" aria-label={t('Planilla de firmas')}>
    <h3>{t('Planilla de firmas')}</h3>
    <p className="muted">{t('Usa los filtros aplicados a la lista e incluye todas sus páginas. Las cinco columnas fijas son N.º, Nombres y apellidos, Tipo de documento, Número de documento y Firma; Firma queda vacía y al final.')}</p>
    <div className="form-grid">
      <label>{t('Encabezado principal')}<input maxLength={120} value={h1} onChange={event => setH1(event.target.value)} /></label>
      <label>{t('Segundo encabezado')}<input maxLength={120} value={h2} onChange={event => setH2(event.target.value)} /></label>
      <label>{t('Tercer encabezado')}<input maxLength={120} value={h3} onChange={event => setH3(event.target.value)} /></label>
    </div>
    <p className="muted">{t('La fecha de Colombia se agrega al descargar, entre el segundo y el tercer encabezado. Estos encabezados parten de la configuración de la junta y puedes ajustarlos para esta descarga. El logo configurado se incluye en Excel, PDF y la vista imprimible.')}</p>
    <fieldset>
      <legend>{t('Columnas adicionales')}</legend>
      <div className="form-grid">{planillaColumns.filter(([key]) => settings?.allowed_columns.includes(key)).map(([key, label]) => <label className="checkbox-label" key={key}>
        <input type="checkbox" checked={columns.includes(key)} onChange={() => toggle(key)} />{t(label)}
      </label>)}</div>
    </fieldset>
    <p aria-live="polite">{t('Seleccionadas: {count} / 5', {count: columns.length})}</p>
    <ErrorBox error={settingsError} />
    {!!settingsError && <button type="button" onClick={() => setRevision(value => value + 1)}>{t('Reintentar configuración')}</button>}
    <ExportFilename value={name} onChange={setName} type="planilla" />
    <ErrorBox error={error} />
    <button type="button" disabled={busy || exporting || !settings || total === undefined || total > 2000 || !exportFilenameReady(name)} onClick={() => void download()}>
      {t(exporting ? 'Preparando planilla…' : 'Descargar planilla Excel')}
    </button>
    <button type="button" disabled={busy || previewing || !settings || total === undefined || total > 2000 || !exportFilenameReady(name)} onClick={() => void preview()}>
      {t(previewing ? 'Preparando vista…' : 'Vista para imprimir o guardar PDF')}
    </button>
    <button type="button" disabled={busy || pdfExporting || !settings || total === undefined || total > 2000 || !exportFilenameReady(name)} onClick={() => void downloadPdf()}>
      {t(pdfExporting ? 'Preparando PDF…' : 'Descargar planilla PDF')}
    </button>
    <p className="muted">{t('La vista se abre en una ventana local. Allí puedes imprimir o elegir «Guardar como PDF» en el navegador; el nombre del archivo es una sugerencia que puedes ajustar en ese diálogo.')}</p>
    {limitAlert && <Modal title={t('Límite de selección')} onClose={() => setLimitAlert(false)}>
      <p>{t('Solo puedes seleccionar máximo 5 campos.')}</p>
      <button type="button" onClick={() => setLimitAlert(false)}>{t('Aceptar')}</button>
    </Modal>}
  </section>;
}
