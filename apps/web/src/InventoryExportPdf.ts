import { t } from './i18n';

export type InventoryExportPdfData = { filename: string; date: string; count: number; headers: string[]; rows: string[][] };

export function inventoryExportPdfDefinition(data: InventoryExportPdfData, organizationName: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.pdf$/.test(data.filename)
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.headers.length !== 14
    || data.count !== data.rows.length || data.rows.length > 2000
    || data.headers.some(value => typeof value !== 'string')
    || data.rows.some(row => row.length !== 14 || row.some(value => typeof value !== 'string'))) {
    throw new Error(t('La exportación PDF recibida no tiene un formato válido.'));
  }
  return {
    pageSize: 'A4', pageMargins: [36, 48, 36, 42],
    info: { title: data.filename.slice(0, -4), subject: t('Inventario SRD') },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#111827' },
    header: { text: `${t('Inventario')} · ${organizationName}`, margin: [36, 16, 36, 0], fontSize: 9, color: '#475569' },
    content: [
      { text: t('Inventario de la junta'), bold: true, fontSize: 19, margin: [0, 0, 0, 6] },
      { text: t('Fecha (Colombia): {date} · Bienes: {count}', { date: data.date, count: data.count }), margin: [0, 0, 0, 14] },
      ...(data.rows.length ? data.rows.flatMap((row, index) => [
        { text: `${index + 1}. ${row[0]} · ${row[2]}`, bold: true, fontSize: 14, margin: [0, 0, 0, 12], ...(index ? { pageBreak: 'before' } : {}) },
        { table: { headerRows: 1, dontBreakRows: true, widths: [135, '*'], body: [
          [{ text: t('Campo'), bold: true, fillColor: '#edf4fa' }, { text: t('Valor'), bold: true, fillColor: '#edf4fa' }],
          ...data.headers.flatMap((label, column) => column === 10 ? [] : [[{ text: t(label), bold: true }, { text: column === 1 || column === 9 ? t(row[column]) : row[column] }]]),
        ] }, layout: { hLineColor: () => '#b7c4d0', vLineColor: () => '#b7c4d0',
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5 } },
        { text: t('Descripción'), bold: true, margin: [0, 14, 0, 6] },
        { text: row[10] || t('Sin descripción registrada.') },
      ]) : [{ text: t('No hay bienes que coincidan con los filtros.') }]),
    ],
    footer: (page: number, pages: number) => ({ text: t('Página {page} de {pages}', { page, pages }), alignment: 'right', margin: [36, 10, 36, 0], fontSize: 8 }),
  };
}

export async function downloadInventoryExportPdf(data: InventoryExportPdfData, organizationName: string): Promise<void> {
  const definition = inventoryExportPdfDefinition(data, organizationName);
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake.js'), import('pdfmake/build/vfs_fonts.js'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  await pdfMake.createPdf(definition).download(data.filename);
}
