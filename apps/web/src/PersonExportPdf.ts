export type PersonExportPdfData = {
  filename: string;
  date: string;
  headers: string[];
  rows: string[][];
  count: number;
};

export function personExportPdfDefinition(data: PersonExportPdfData, organizationName: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.pdf$/.test(data.filename)
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)
    || data.headers.length !== 12 || data.rows.length > 2000 || data.count !== data.rows.length
    || data.rows.some(row => row.length !== 12 || row.some(value => typeof value !== 'string'))
    || data.headers.some(value => typeof value !== 'string')) {
    throw new Error('La exportación PDF recibida no tiene un formato válido.');
  }
  const weights = [3, 10, 10, 12, 11, 7, 7, 7, 9, 9, 12, 19];
  const available = 1134 - data.headers.length * 7;
  const total = weights.reduce((sum, value) => sum + value, 0);
  return {
    pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [28, 32, 28, 38],
    info: { title: data.filename.slice(0, -4), subject: 'Listado de personas SRD' },
    defaultStyle: { font: 'Roboto', fontSize: 7.5, color: '#111827' },
    content: [
      { text: 'Listado de personas', bold: true, fontSize: 16, margin: [0, 0, 0, 3] },
      { text: organizationName, fontSize: 10, margin: [0, 0, 0, 3] },
      { text: `Fecha (Colombia): ${data.date}    Personas: ${data.count}`, margin: [0, 0, 0, 10] },
      { table: {
        headerRows: 1, dontBreakRows: true,
        widths: weights.map(value => available * value / total),
        body: [data.headers.map(text => ({ text, bold: true, fillColor: '#edf4fa' })),
          ...data.rows.map(row => row.map(text => ({ text })))],
      }, layout: {
        hLineColor: () => '#b7c4d0', vLineColor: () => '#b7c4d0',
        hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        paddingLeft: () => 3, paddingRight: () => 3,
        paddingTop: () => 4, paddingBottom: () => 4,
      } },
    ],
    footer: (page: number, pages: number) => ({ text: `Página ${page} de ${pages}`,
      alignment: 'right', margin: [28, 10, 28, 0], fontSize: 8 }),
  };
}

export async function downloadPersonExportPdf(data: PersonExportPdfData, organizationName: string): Promise<void> {
  const definition = personExportPdfDefinition(data, organizationName);
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake.js'), import('pdfmake/build/vfs_fonts.js'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  await pdfMake.createPdf(definition).download(data.filename);
}
