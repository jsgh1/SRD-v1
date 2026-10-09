import type { PlanillaPreview } from './PlanillaPrint';

export type PlanillaPdfData = Omit<PlanillaPreview, 'title'> & { filename: string };

export function planillaPdfDefinition(data: PlanillaPdfData) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.pdf$/.test(data.filename)
    || data.headers.length < 5 || data.headers.length > 10
    || data.rows.length > 2000 || data.rows.some(row => row.length !== data.headers.length)) {
    throw new Error('La planilla PDF recibida no tiene un formato válido.');
  }

  const optionalColumns = data.headers.length - 5;
  const weights = [5, 22, 14, 15, ...Array(optionalColumns).fill(9), 17];
  const available = 780 - data.headers.length * 7;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map(weight => available * weight / total);
  const heading = (value: string, fontSize: number, bold = false) => [
    { text: value, colSpan: data.headers.length, alignment: 'center', fontSize, bold,
      border: [false, false, false, false], margin: [0, 2, 0, 2] },
    ...Array(data.headers.length - 1).fill(''),
  ];
  const body = [
    heading(data.headings.h1, 15, true),
    heading(data.headings.h2, 10),
    heading(data.language === 'en'
      ? `MONTH: ${data.date.month}    DAY: ${data.date.day}    YEAR: ${data.date.year}`
      : `MES: ${data.date.month}    DÍA: ${data.date.day}    AÑO: ${data.date.year}`, 10),
    heading(data.headings.h3, 12, true),
    data.headers.map(text => ({ text, bold: true, alignment: 'center', fillColor: '#edf4fa' })),
    ...data.rows.map(row => row.map(value => ({ text: value ?? '' }))),
  ];
  const signature = (label: string) => ({
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 260, y2: 0, lineWidth: 0.8 }] },
      { text: label, bold: true, alignment: 'center', margin: [0, 7, 0, 0] },
    ], width: 260,
  });
  return {
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [30, 30, 30, 36],
    info: { title: data.filename.slice(0, -4), subject: data.language === 'en' ? 'SRD signature sheet' : 'Planilla de firmas SRD' },
    defaultStyle: { font: 'Roboto', fontSize: 8, color: '#111827' },
    content: [
      ...(data.logo_data?.startsWith('data:image/png;base64,')
        ? [{ image: data.logo_data, fit: [64, 64], absolutePosition: { x: 34, y: 30 } }] : []),
      { table: { headerRows: 5, dontBreakRows: true, widths, body },
        layout: {
          hLineWidth: (index: number) => index < 4 ? 0 : 0.6,
          vLineWidth: () => 0.6,
          hLineColor: () => '#2b3340', vLineColor: () => '#2b3340',
          paddingLeft: () => 3, paddingRight: () => 3,
          paddingTop: (index: number) => index < 4 ? 1 : 5,
          paddingBottom: (index: number) => index < 4 ? 1 : 5,
        } },
      { unbreakable: true, margin: [35, 42, 35, 0],
        columns: (data.language === 'en' ? ['PRESIDENT', 'SECRETARY'] : ['PRESIDENTE', 'SECRETARIO']).map(signature), columnGap: 60 },
    ],
  };
}

export async function downloadPlanillaPdf(data: PlanillaPdfData): Promise<void> {
  const definition = planillaPdfDefinition(data);
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake.js'), import('pdfmake/build/vfs_fonts.js'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  await pdfMake.createPdf(definition).download(data.filename);
}
