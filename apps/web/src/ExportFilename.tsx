import { t, useLanguage } from './i18n';

export type ExportFilenameChoice = { name: string; confirmed: boolean };

export function ExportFilename({ value, onChange, type, defaultDescription }: {
  value: ExportFilenameChoice;
  onChange: (next: ExportFilenameChoice) => void;
  type: 'auditoria' | 'inventario' | 'tesoreria' | 'personas' | 'planilla' | 'ficha_persona' | 'movimientos_inventario';
  defaultDescription?: string;
}) {
  useLanguage();
  return <div className="form-grid export-filename">
    <label>{t('Nombre del archivo (opcional)')}
      <input maxLength={100} value={value.name} onChange={event => onChange({ name: event.target.value, confirmed: false })} />
    </label>
    <label className="checkbox-label"><input type="checkbox" checked={value.confirmed}
      disabled={!value.name.trim()} onChange={event => onChange({ ...value, confirmed: event.target.checked })} />
      {t('Confirmo el nombre del archivo')}</label>
    <p className="muted">{defaultDescription ? t(defaultDescription) : (type === 'planilla' || type === 'personas'
      ? t('Si dejas el nombre vacío, se descargará como {type}_AAAA-MM-DD.xlsx o {type}_AAAA-MM-DD.pdf, según el formato, con la fecha de Colombia.', {type})
      : t('Si dejas el nombre vacío, se descargará como {type}_AAAA-MM-DD.xlsx con la fecha de Colombia.', {type}))} {t('El nombre escrito se sanea antes de descargar.')}</p>
  </div>;
}

export function addExportFilename(params: URLSearchParams, choice: ExportFilenameChoice) {
  if (choice.name.trim()) {
    params.set('filename', choice.name.trim());
    params.set('confirm_filename', choice.confirmed ? '1' : '0');
  }
}

export const exportFilenameReady = (choice: ExportFilenameChoice) => !choice.name.trim() || choice.confirmed;
export const safeXlsxFilename = (filename: string) => /^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.xlsx$/.test(filename);
