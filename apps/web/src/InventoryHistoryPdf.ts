export type InventoryHistoryPdfData = { filename: string; date: string; count: number; headers: string[]; rows: string[][] };

export function inventoryHistoryPdfDefinition(data: InventoryHistoryPdfData, organizationName: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.pdf$/.test(data.filename)
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.headers.length !== 11
    || data.count !== data.rows.length || data.rows.length > 2000
    || data.headers.some(value => typeof value !== 'string')
    || data.rows.some(row => row.length !== 11 || row.some(value => typeof value !== 'string'))) {
    throw new Error('La exportación PDF recibida no tiene un formato válido.');
  }
  return {
    pageSize: 'A4', pageMargins: [36, 48, 36, 42],
    info: { title: data.filename.slice(0, -4), subject: 'Historial de Inventario SRD' },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#111827' },
    header: { text: `Inventario · ${organizationName}`, margin: [36, 16, 36, 0], fontSize: 9, color: '#475569' },
    content: [
      { text: 'Historial de movimientos de Inventario', bold: true, fontSize: 19, margin: [0, 0, 0, 6] },
      { text: `Fecha (Colombia): ${data.date} · Movimientos: ${data.count}`, margin: [0, 0, 0, 14] },
      { text: 'Las existencias anteriores y posteriores son históricas; no se recalculan con los filtros ni representan necesariamente la existencia actual.', fontSize: 9, margin: [0, 0, 0, 12] },
      ...(data.rows.length ? data.rows.flatMap((row, index) => [
        { text: `Movimiento ${row[2]} · ${row[0]}`, bold: true, fontSize: 14, margin: [0, 0, 0, 12], ...(index ? { pageBreak: 'before' } : {}) },
        { table: { headerRows: 1, dontBreakRows: true, widths: [135, '*'], body: [
          [{ text: 'Campo', bold: true, fillColor: '#edf4fa' }, { text: 'Valor', bold: true, fillColor: '#edf4fa' }],
          ...data.headers.flatMap((label, column) => column === 8 ? [] : [[{ text: label, bold: true }, { text: row[column] }]]),
        ] }, layout: { hLineColor: () => '#b7c4d0', vLineColor: () => '#b7c4d0',
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5 } },
        { text: 'Motivo', bold: true, margin: [0, 14, 0, 6] },
        { text: row[8] || 'Sin motivo registrado.' },
      ]) : [{ text: 'No hay movimientos que coincidan con los filtros aplicados.' }]),
    ],
    footer: (page: number, pages: number) => ({ text: `Página ${page} de ${pages}`, alignment: 'right', margin: [36, 10, 36, 0], fontSize: 8 }),
  };
}

export async function downloadInventoryHistoryPdf(data: InventoryHistoryPdfData, organizationName: string, isCurrent: () => boolean = () => true): Promise<void> {
  const definition = inventoryHistoryPdfDefinition(data, organizationName);
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake.js'), import('pdfmake/build/vfs_fonts.js'),
  ]);
  if (!isCurrent()) return;
  pdfMake.addVirtualFileSystem(fonts);
  await pdfMake.createPdf(definition).download(data.filename);
}
