import { t } from './i18n';

export type TreasuryReceipt = {
  id: string; number: number; receipt: string; kind: 'opening' | 'income' | 'expense' | 'reversal';
  sign: number; amount: string; balance_after: string; effective_date: string; concept: string;
  support_note: string | null; actor_name: string; actor_id: string;
  reverses_id: string | null; reversed_by_id?: string | null; created_at: string;
};

const labels = { opening: 'Apertura', income: 'Ingreso', expense: 'Egreso', reversal: 'Reverso' };
const money = (value: string) => {
  const [whole, fraction] = value.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction} COP`;
};

export function treasuryReceiptPdfDefinition(receipt: TreasuryReceipt, organizationName: string) {
  if (!/^TES-\d{6,12}$/.test(receipt.receipt) || !(receipt.kind in labels)
    || ![1, -1].includes(receipt.sign)
    || !/^\d+\.\d{2}$/.test(receipt.amount) || !/^\d+\.\d{2}$/.test(receipt.balance_after)) {
    throw new Error(t('El comprobante recibido no tiene un formato válido.'));
  }
  const rows = [
    [t('Tipo de asiento'), t(labels[receipt.kind])],
    [t('Fecha efectiva'), receipt.effective_date],
    [t('Importe'), `${receipt.sign === -1 ? '−' : '+'}${money(receipt.amount)}`],
    [t('Saldo tras asiento'), money(receipt.balance_after)],
    [t('Concepto'), receipt.concept],
    [t('Responsable al registrar'), receipt.actor_name],
    [t('Registro UTC'), receipt.created_at],
    [t('Identificador del asiento'), receipt.id],
    ...(receipt.support_note ? [[t('Referencia del soporte'), receipt.support_note]] : []),
    ...(receipt.reverses_id ? [[t('Revierte el asiento'), receipt.reverses_id]] : []),
    ...(receipt.reversed_by_id ? [[t('Revertido por el asiento'), receipt.reversed_by_id]] : []),
  ];
  return {
    pageSize: 'A4', pageMargins: [40, 40, 40, 42],
    info: { title: t('Comprobante {number}', { number: receipt.receipt }), subject: t('Tesorería SRD') },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#111827' },
    content: [
      { text: t('Comprobante de tesorería'), fontSize: 20, bold: true, margin: [0, 0, 0, 8] },
      { text: organizationName, fontSize: 12, margin: [0, 0, 0, 8] },
      { text: receipt.receipt, fontSize: 14, bold: true, margin: [0, 0, 0, 18] },
      { table: { widths: [145, '*'], dontBreakRows: true,
        body: rows.map(([label, value]) => [
          { text: label, bold: true, fillColor: '#edf4fa' }, { text: value },
        ]),
      }, layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        hLineColor: () => '#b7c4d0', vLineColor: () => '#b7c4d0',
        paddingLeft: () => 8, paddingRight: () => 8,
        paddingTop: () => 8, paddingBottom: () => 8,
      } },
      { text: t('El saldo corresponde al momento en que se confirmó este asiento. Este comprobante registra información de la junta y no acredita una transferencia bancaria.'),
        fontSize: 9, color: '#4b5563', margin: [0, 18, 0, 0] },
    ],
    footer: (page: number, pages: number) => ({ text: t('Página {page} de {pages}', { page, pages }),
      alignment: 'right', fontSize: 8, margin: [40, 12, 40, 0] }),
  };
}

export async function downloadTreasuryReceiptPdf(receipt: TreasuryReceipt, organizationName: string, filename = `comprobante_${receipt.receipt}.pdf`): Promise<void> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.pdf$/.test(filename)) {
    throw new Error(t('El nombre del comprobante PDF no tiene un formato válido.'));
  }
  const definition = treasuryReceiptPdfDefinition(receipt, organizationName);
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake.js'), import('pdfmake/build/vfs_fonts.js'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  await pdfMake.createPdf(definition).download(filename);
}
