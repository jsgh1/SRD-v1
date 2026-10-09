import { t } from './i18n';

export type AuditExportPdfData = { filename: string; date: string; count: number; headers: string[]; rows: string[][] };

export function auditExportPdfDefinition(data: AuditExportPdfData, organizationName: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.pdf$/.test(data.filename)
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.headers.length !== 8
    || data.count !== data.rows.length || data.rows.length > 2000
    || data.headers.some(value => typeof value !== 'string')
    || data.rows.some(row => row.length !== 8 || row.some(value => typeof value !== 'string'))) {
    throw new Error(t('La exportación PDF recibida no tiene un formato válido.'));
  }
  return {
    pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [28, 44, 28, 36],
    info: { title: data.filename.slice(0, -4), subject: t('Auditoría SRD') },
    defaultStyle: { font: 'Roboto', fontSize: 8, color: '#111827' },
    header: { text: t('Auditoría · {name}', { name: organizationName }), margin: [28, 14, 28, 0], fontSize: 9, color: '#475569' },
    content: [
      { text: t('Auditoría de la junta'), bold: true, fontSize: 18, margin: [0, 0, 0, 6] },
      { text: t('Fecha de descarga (Colombia): {date} · Eventos: {count}', { date: data.date, count: data.count }), fontSize: 10, margin: [0, 0, 0, 6] },
      { text: t('Las fechas de los eventos y los filtros por día corresponden a UTC. Los identificadores no conceden acceso al recurso asociado.'), fontSize: 9, margin: [0, 0, 0, 12] },
      ...(data.rows.length ? [{ table: { headerRows: 1, dontBreakRows: true,
        widths: [105, 65, 150, 55, 160, 160, 160, 160], body: [
          data.headers.map(text => ({ text, bold: true, fillColor: '#edf4fa' })),
          ...data.rows.map(row => row.map(text => ({ text }))),
        ] }, layout: { hLineColor: () => '#b7c4d0', vLineColor: () => '#b7c4d0',
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 5, paddingBottom: () => 5 } }]
        : [{ text: t('No hay eventos que coincidan con los filtros.'), fontSize: 10 }]),
    ],
    footer: (page: number, pages: number) => ({ text: t('Página {page} de {pages}', { page, pages }), alignment: 'right', margin: [28, 10, 28, 0], fontSize: 8 }),
  };
}

export async function downloadAuditExportPdf(data: AuditExportPdfData, organizationName: string): Promise<void> {
  const definition = auditExportPdfDefinition(data, organizationName);
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake.js'), import('pdfmake/build/vfs_fonts.js'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  await pdfMake.createPdf(definition).download(data.filename);
}
