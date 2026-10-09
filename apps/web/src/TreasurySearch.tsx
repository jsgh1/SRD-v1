import { useEffect, useState } from 'react';
import { api } from './api';
import { Empty, ErrorBox, Loading, Modal } from './ui';
import { useRequestGeneration } from './useRequestGeneration';
import { t, useLanguage } from './i18n';

type Receipt = {
  id: string; receipt: string; kind: 'opening' | 'income' | 'expense' | 'reversal'; sign: number;
  amount: string; balance_after: string; effective_date: string; concept: string;
  actor_name: string; support_note: string | null; reverses_id: string | null; reversed_by_id: string | null;
};
type Page = { items: Receipt[]; total: number; page_size: number };
const kinds = { opening: 'Apertura', income: 'Ingreso', expense: 'Egreso', reversal: 'Reverso' };
const cop = (value: string) => {
  const [whole, fraction = '00'] = value.split('.');
  return `$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`;
};

export function TreasurySearch({ query }: { query: string }) {
  useLanguage();
  const generation = useRequestGeneration();
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const [data, setData] = useState<Page>(), [error, setError] = useState<unknown>();
  const [selected, setSelected] = useState<Receipt>(), [detailError, setDetailError] = useState<unknown>();
  const [detailBusy, setDetailBusy] = useState(false);
  useEffect(() => {
    let active = true; setData(undefined); setError(undefined);
    api<Page>(`treasury?${new URLSearchParams({ q: query, page: String(page) })}`)
      .then(result => { if (active) setData(result); })
      .catch(value => { if (active) setError(value); });
    return () => { active = false; };
  }, [query, page, retry]);

  async function open(id: string) {
    const current = ++generation.current;
    setDetailBusy(true); setDetailError(undefined); setSelected(undefined);
    try { const value = await api<Receipt>(`treasury/movements/${id}`); if (current === generation.current) setSelected(value); }
    catch (value) { if (current === generation.current) setDetailError(value); }
    finally { if (current === generation.current) setDetailBusy(false); }
  }

  return <section className="panel" aria-label={t('Resultados de tesorería')}>
    <h2>{t('Tesorería')}</h2>
    <ErrorBox error={error} />
    {error ? <button onClick={() => setRetry(value => value + 1)}>{t('Reintentar tesorería')}</button> : !data && <Loading />}
    {data && <>
      <p role="status">{t('{count} coincidencias en tesorería', { count: data.total })}</p>
      {!data.items.length ? <Empty title={t('Sin coincidencias en tesorería')}>{t('Prueba otro concepto o comprobante completo.')}</Empty> :
        <div className="table-scroll"><table><thead><tr><th>{t('Comprobante')}</th><th>{t('Fecha')}</th><th>{t('Tipo')}</th><th>{t('Concepto')}</th><th>{t('Importe')}</th><th></th></tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id}>
            <td>{item.receipt}</td><td>{item.effective_date}</td><td>{t(kinds[item.kind])}</td><td>{item.concept}</td>
            <td>{item.sign === -1 ? '−' : '+'}{cop(item.amount)}</td>
            <td><button onClick={() => void open(item.id)} aria-label={t('Ver comprobante {receipt}', { receipt: item.receipt })}>{t('Ver comprobante')}</button></td>
          </tr>)}</tbody></table></div>}
      <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>{t('Anterior')}</button>
        <span>{t('Página {page}', { page })}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>{t('Siguiente')}</button></div>
    </>}
    <ErrorBox error={detailError} />
    {detailBusy && <Loading />}
    {selected && <Modal title={t('Comprobante {receipt}', { receipt: selected.receipt })} onClose={() => { generation.current++; setSelected(undefined); setDetailBusy(false); setDetailError(undefined); }}>
      <dl className="treasury-receipt">
        <div><dt>{t('Tipo')}</dt><dd>{t(kinds[selected.kind])}</dd></div>
        <div><dt>{t('Importe')}</dt><dd>{selected.sign === -1 ? '−' : '+'}{cop(selected.amount)}</dd></div>
        <div><dt>{t('Concepto')}</dt><dd>{selected.concept}</dd></div>
        <div><dt>{t('Fecha efectiva')}</dt><dd>{selected.effective_date}</dd></div>
        <div><dt>{t('Responsable')}</dt><dd>{selected.actor_name}</dd></div>
        <div><dt>{t('Saldo tras asiento')}</dt><dd>{cop(selected.balance_after)}</dd></div>
        {selected.support_note && <div><dt>{t('Referencia del soporte')}</dt><dd>{selected.support_note}</dd></div>}
        {selected.reverses_id && <div><dt>{t('Revierte a')}</dt><dd>{selected.reverses_id}</dd></div>}
        {selected.reversed_by_id && <div><dt>{t('Revertido por')}</dt><dd>{selected.reversed_by_id}</dd></div>}
      </dl>
    </Modal>}
  </section>;
}
