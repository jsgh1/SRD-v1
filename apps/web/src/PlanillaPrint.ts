export type PlanillaPreview = {
  title: string;
  language: 'es' | 'en';
  headings: { h1: string; h2: string; h3: string };
  logo_data: string | null;
  date: { month: string; day: string; year: string };
  headers: string[];
  rows: string[][];
  count: number;
};

export function showPlanillaPrint(popup: Window, preview: PlanillaPreview) {
  const doc = popup.document;
  doc.open();
  doc.write(`<!doctype html><html lang="${preview.language}"><head><meta charset="utf-8"><title></title></head><body></body></html>`);
  doc.close();
  doc.title = preview.title;
  const style = doc.createElement('style');
  style.textContent = `
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 18px; color: #182336; font: 12px Arial, sans-serif; }
    .toolbar { display: flex; align-items: center; gap: 12px; padding: 12px; margin-bottom: 18px; background: #edf4fa; }
    .toolbar button { padding: 8px 14px; cursor: pointer; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td { overflow-wrap: anywhere; }
    .heading th { border: 0; text-align: center; padding: 3px; font-weight: normal; }
    .heading.main th { font-weight: 700; font-size: 17px; }
    .heading.third th { font-weight: 700; font-size: 14px; padding-bottom: 14px; }
    .sheet-logo { position: absolute; top: 80px; left: 26px; width: 64px; height: 64px; object-fit: contain; }
    .column-head th { border: 1px solid #333; padding: 7px 4px; background: #e8eef2; }
    tbody td { border: 1px solid #333; padding: 6px 4px; min-height: 26px; }
    tbody td:last-child { height: 27px; }
    .signatures { display: flex; justify-content: space-around; gap: 35px; margin-top: 58px; break-inside: avoid; page-break-inside: avoid; }
    .signatures div { width: 36%; text-align: center; border-top: 1px solid #333; padding-top: 7px; font-weight: 700; }
    @media print { body { margin: 0; color: #000; } .toolbar { display: none; } .sheet-logo { top: 0; left: 0; } }
  `;
  doc.head.append(style);

  const toolbar = doc.createElement('div');
  toolbar.className = 'toolbar';
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = preview.language === 'en' ? 'Print or save as PDF' : 'Imprimir o guardar como PDF';
  button.addEventListener('click', () => popup.print());
  const hint = doc.createElement('span');
  hint.textContent = preview.language === 'en'
    ? `Suggested name: ${preview.title}.pdf. Select “Save as PDF” in your browser.`
    : `Nombre sugerido: ${preview.title}.pdf. Elige «Guardar como PDF» en el diálogo del navegador.`;
  toolbar.append(button, hint);
  doc.body.append(toolbar);

  if (preview.logo_data?.startsWith('data:image/png;base64,')) {
    const logo = doc.createElement('img');
    logo.className = 'sheet-logo';
    logo.alt = preview.language === 'en' ? 'Council logo' : 'Logo de la junta';
    logo.src = preview.logo_data;
    doc.body.append(logo);
  }

  const table = doc.createElement('table');
  const optionalColumns = Math.max(0, preview.headers.length - 5);
  const widths = [5, 22, 14, 15, ...Array(optionalColumns).fill(9), 17];
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const columns = doc.createElement('colgroup');
  for (const width of widths) {
    const column = doc.createElement('col');
    column.style.width = `${(width / totalWidth) * 100}%`;
    columns.append(column);
  }
  table.append(columns);
  const head = table.createTHead();
  const heading = (value: string, className: string) => {
    const row = head.insertRow(); row.className = `heading ${className}`;
    const cell = doc.createElement('th'); cell.colSpan = preview.headers.length;
    cell.textContent = value; row.append(cell);
  };
  heading(preview.headings.h1, 'main');
  heading(preview.headings.h2, 'second');
  heading(preview.language === 'en'
    ? `MONTH: ${preview.date.month}     DAY: ${preview.date.day}     YEAR: ${preview.date.year}`
    : `MES: ${preview.date.month}     DÍA: ${preview.date.day}     AÑO: ${preview.date.year}`, 'date');
  heading(preview.headings.h3, 'third');
  const labelRow = head.insertRow(); labelRow.className = 'column-head';
  for (const label of preview.headers) {
    const cell = doc.createElement('th'); cell.scope = 'col'; cell.textContent = label; labelRow.append(cell);
  }
  const body = table.createTBody();
  for (const values of preview.rows) {
    const row = body.insertRow();
    for (const value of values) { const cell = row.insertCell(); cell.textContent = value; }
  }
  doc.body.append(table);
  const signatures = doc.createElement('div'); signatures.className = 'signatures';
  for (const title of (preview.language === 'en' ? ['PRESIDENT', 'SECRETARY'] : ['PRESIDENTE', 'SECRETARIO'])) {
    const line = doc.createElement('div'); line.textContent = title; signatures.append(line);
  }
  doc.body.append(signatures);
  popup.focus();
}
