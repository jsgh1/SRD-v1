import { t } from './i18n';

export type TreasuryHistoryPdfData = { filename: string; date: string; count: number; headers: string[]; rows: string[][] };

export function treasuryHistoryPdfDefinition(data: TreasuryHistoryPdfData, organizationName: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.pdf$/.test(data.filename)
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.headers.length !== 12
    || data.count !== data.rows.length || data.rows.length > 2000
    || data.headers.some(value => typeof value !== 'string')
    || data.rows.some(row => row.length !== 12 || row.some(value => typeof value !== 'string'))) {
    throw new Error(t('La exportación PDF recibida no tiene un formato válido.'));
  }
  return {
    pageSize: 'A4', pageMargins: [36, 48, 36, 42],
    info: { title: data.filename.slice(0, -4), subject: t('Historial de Tesorería SRD') },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#111827' },
    header: { text: `${t('Tesorería')} · ${organizationName}`, margin: [36, 16, 36, 0], fontSize: 9, color: '#475569' },
    content: [
      { text: t('Historial de Tesorería'), bold: true, fontSize: 19, margin: [0, 0, 0, 6] },
      { text: t('Fecha (Colombia): {date} · Asientos: {count}', { date: data.date, count: data.count }), margin: [0, 0, 0, 8] },
      { text: t('El saldo tras asiento corresponde al momento de su confirmación. No se recalcula con los filtros ni representa necesariamente el saldo actual.'), fontSize: 9, margin: [0, 0, 0, 14] },
      ...(data.rows.length ? data.rows.flatMap((row, index) => [
        { text: `${index + 1}. ${row[0]} · ${t(row[2])}`, bold: true, fontSize: 14, margin: [0, 0, 0, 12], ...(index ? { pageBreak: 'before' } : {}) },
        { table: { headerRows: 1, dontBreakRows: true, widths: [135, '*'], body: [
          [{ text: t('Campo'), bold: true, fillColor: '#edf4fa' }, { text: t('Valor'), bold: true, fillColor: '#edf4fa' }],
          ...data.headers.flatMap((label, column) => column === 6 || column === 7 ? [] : [[{ text: t(label), bold: true }, { text: column === 2 ? t(row[column]) : row[column] }]]),
        ] }, layout: { hLineColor: () => '#b7c4d0', vLineColor: () => '#b7c4d0',
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5 } },
        { text: t('Concepto'), bold: true, margin: [0, 14, 0, 6] }, { text: row[6] },
        { text: t('Referencia del soporte'), bold: true, margin: [0, 14, 0, 6] }, { text: row[7] || t('Sin referencia registrada.') },
      ]) : [{ text: t('No hay asientos que coincidan con los filtros.') }]),
    ],
    footer: (page: number, pages: number) => ({ text: t('Página {page} de {pages}', { page, pages }), alignment: 'right', margin: [36, 10, 36, 0], fontSize: 8 }),
  };
}

export async function downloadTreasuryHistoryPdf(data: TreasuryHistoryPdfData, organizationName: string): Promise<void> {
  const definition = treasuryHistoryPdfDefinition(data, organizationName);
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake.js'), import('pdfmake/build/vfs_fonts.js'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  await pdfMake.createPdf(definition).download(data.filename);
}
