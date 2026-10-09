import { useEffect, useState } from 'react';
import { api } from './api';
import { PersonPhotos } from './PersonPhotos';
import { Empty, ErrorBox, Loading, Modal } from './ui';
import { useRequestGeneration } from './useRequestGeneration';
import { t, useLanguage } from './i18n';

type Asset = {
  id: string; code: string; name: string; type: 'real_estate' | 'movable'; quantity: number;
  unit: string | null; location: string; condition: string; status: 'active' | 'retired';
  category: string | null; description: string | null; responsible_name: string | null;
  name_en?: string | null; unit_en?: string | null; location_en?: string | null; condition_en?: string | null;
  category_en?: string | null; description_en?: string | null;
};
type Movement = { id: string; sequence: number; type: string; delta: number; quantity_after: number; reason: string; reason_en?: string | null; performer_name: string };
type Page = { items: Asset[]; total: number; page_size: number };
type Detail = { asset: Asset; movements: Movement[]; movement_page: number; movement_page_size: number; movement_total: number };
const movementLabels: Record<string, string> = { opening: 'Registro inicial', in: 'Entrada', out: 'Salida', adjust: 'Ajuste', retire: 'Baja' };

export function AssetSearch({ query }: { query: string }) {
  const language = useLanguage();
  const localized = (spanish: string | null, english?: string | null) => language === 'en' && english ? english : spanish || '';
  const generation = useRequestGeneration();
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const [data, setData] = useState<Page>(), [error, setError] = useState<unknown>();
  const [detail, setDetail] = useState<Detail>(), [detailError, setDetailError] = useState<unknown>();
  const [detailBusy, setDetailBusy] = useState(false);
  const [movementBusy, setMovementBusy] = useState(false), [movementError, setMovementError] = useState<unknown>();
  useEffect(() => {
    let active = true; setData(undefined); setError(undefined);
    api<Page>(`assets?${new URLSearchParams({ q: query, page: String(page) })}`)
      .then(result => { if (active) setData(result); })
      .catch(value => { if (active) setError(value); });
    return () => { active = false; };
  }, [query, page, retry]);

  async function open(id: string) {
    const current = ++generation.current;
    setMovementBusy(false);
    setDetailBusy(true); setDetailError(undefined); setMovementError(undefined); setDetail(undefined);
    try { const value = await api<Detail>(`assets/${id}`); if (current === generation.current) setDetail(value); }
    catch (value) { if (current === generation.current) setDetailError(value); }
    finally { if (current === generation.current) setDetailBusy(false); }
  }
  async function movementPage(pageNumber: number) {
    if (!detail || movementBusy) return;
    const id = detail.asset.id;
    const currentGeneration = ++generation.current;
    setMovementBusy(true); setMovementError(undefined);
    try {
      const result = await api<Detail>(`assets/${id}?movement_page=${pageNumber}`);
      if (currentGeneration !== generation.current) return;
      setDetail(current => current?.asset.id === id ? result : current);
    } catch (value) { if (currentGeneration === generation.current) setMovementError(value); }
    finally { if (currentGeneration === generation.current) setMovementBusy(false); }
  }

  return <section className="panel" aria-label={t('Resultados de bienes')}>
    <h2>{t('Bienes de inventario')}</h2>
    <ErrorBox error={error} />
    {error ? <button onClick={() => setRetry(value => value + 1)}>{t('Reintentar bienes')}</button> : !data && <Loading />}
    {data && <>
      <p role="status">{t('{count} coincidencias en bienes', { count: data.total })}</p>
      {!data.items.length ? <Empty title={t('Sin coincidencias en bienes')}>{t('Prueba otro código o nombre.')}</Empty> :
        <div className="table-scroll"><table><thead><tr><th>{t('Código')}</th><th>{t('Bien')}</th><th>{t('Tipo')}</th><th>{t('Ubicación')}</th><th>{t('Estado')}</th><th></th></tr></thead>
          <tbody>{data.items.map(asset => <tr key={asset.id}>
            <td>{asset.code}</td><td>{localized(asset.name, asset.name_en)}</td><td>{t(asset.type === 'movable' ? 'Mueble' : 'Inmueble')}</td>
            <td>{localized(asset.location, asset.location_en)}</td><td>{t(asset.status === 'active' ? 'Activo' : 'De baja')}</td>
            <td><button onClick={() => void open(asset.id)} aria-label={t('Ver bien {code}', { code: asset.code })}>{t('Ver bien')}</button></td>
          </tr>)}</tbody></table></div>}
      <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>{t('Anterior')}</button>
        <span>{t('Página {page}', { page })}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>{t('Siguiente')}</button></div>
    </>}
    <ErrorBox error={detailError} />
    {detailBusy && <Loading />}
    {detail && <Modal title={`${detail.asset.code} · ${localized(detail.asset.name, detail.asset.name_en)}`} onClose={() => { generation.current++; setDetail(undefined); setDetailBusy(false); setMovementBusy(false); setDetailError(undefined); setMovementError(undefined); }}>
      <dl className="treasury-receipt">
        <div><dt>{t('Tipo')}</dt><dd>{t(detail.asset.type === 'movable' ? 'Mueble' : 'Inmueble')}</dd></div>
        <div><dt>{t('Ubicación')}</dt><dd>{localized(detail.asset.location, detail.asset.location_en)}</dd></div>
        <div><dt>{t('Condición')}</dt><dd>{localized(detail.asset.condition, detail.asset.condition_en)}</dd></div>
        <div><dt>{t('Existencia')}</dt><dd>{detail.asset.quantity}{detail.asset.unit ? ` ${localized(detail.asset.unit, detail.asset.unit_en)}` : ''}</dd></div>
        <div><dt>{t('Estado')}</dt><dd>{t(detail.asset.status === 'active' ? 'Activo' : 'De baja')}</dd></div>
        {detail.asset.category && <div><dt>{t('Categoría')}</dt><dd>{localized(detail.asset.category, detail.asset.category_en)}</dd></div>}
        {detail.asset.responsible_name && <div><dt>{t('Responsable')}</dt><dd>{detail.asset.responsible_name}</dd></div>}
        {detail.asset.description && <div><dt>{t('Descripción')}</dt><dd>{localized(detail.asset.description, detail.asset.description_en)}</dd></div>}
      </dl>
      <PersonPhotos id={detail.asset.id} kind="asset" writable={detail.asset.status === 'active'} />
      <h3>{t('Historial de movimientos')}</h3>
      <p role="status">{t('{count} movimientos', { count: detail.movement_total })}</p>
      <ErrorBox error={movementError} />
      {movementBusy && <Loading />}
      <div className="table-scroll"><table><thead><tr><th>{t('N.º')}</th><th>{t('Operación')}</th><th>{t('Cambio')}</th><th>{t('Existencia')}</th><th>{t('Motivo')}</th><th>{t('Responsable')}</th></tr></thead>
        <tbody>{detail.movements.map(item => <tr key={item.id}><td>{item.sequence}</td><td>{t(movementLabels[item.type] || item.type)}</td>
          <td>{item.delta > 0 ? '+' : ''}{item.delta}</td><td>{item.quantity_after}</td><td>{localized(item.reason, item.reason_en)}</td><td>{item.performer_name}</td></tr>)}</tbody></table></div>
      {detail.movement_total > detail.movement_page_size && <div className="pagination">
        <button disabled={movementBusy || detail.movement_page === 1} onClick={() => void movementPage(detail.movement_page - 1)}>{t('Movimientos más recientes')}</button>
        <span>{t('Página {page}', { page: detail.movement_page })}</span>
        <button disabled={movementBusy || detail.movement_page * detail.movement_page_size >= detail.movement_total} onClick={() => void movementPage(detail.movement_page + 1)}>{t('Movimientos más antiguos')}</button>
      </div>}
    </Modal>}
  </section>;
}
