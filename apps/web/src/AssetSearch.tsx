import { useEffect, useState } from 'react';
import { api } from './api';
import { PersonPhotos } from './PersonPhotos';
import { Empty, ErrorBox, Loading, Modal } from './ui';
import { useRequestGeneration } from './useRequestGeneration';

type Asset = {
  id: string; code: string; name: string; type: 'real_estate' | 'movable'; quantity: number;
  unit: string | null; location: string; condition: string; status: 'active' | 'retired';
  category: string | null; description: string | null; responsible_name: string | null;
};
type Movement = { id: string; sequence: number; type: string; delta: number; quantity_after: number; reason: string; performer_name: string };
type Page = { items: Asset[]; total: number; page_size: number };
type Detail = { asset: Asset; movements: Movement[]; movement_page: number; movement_page_size: number; movement_total: number };
const movementLabels: Record<string, string> = { opening: 'Registro inicial', in: 'Entrada', out: 'Salida', adjust: 'Ajuste', retire: 'Baja' };

export function AssetSearch({ query }: { query: string }) {
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

  return <section className="panel" aria-label="Resultados de bienes">
    <h2>Bienes de inventario</h2>
    <ErrorBox error={error} />
    {error ? <button onClick={() => setRetry(value => value + 1)}>Reintentar bienes</button> : !data && <Loading />}
    {data && <>
      <p role="status">{data.total} coincidencias en bienes</p>
      {!data.items.length ? <Empty title="Sin coincidencias en bienes">Prueba otro código o nombre.</Empty> :
        <div className="table-scroll"><table><thead><tr><th>Código</th><th>Bien</th><th>Tipo</th><th>Ubicación</th><th>Estado</th><th></th></tr></thead>
          <tbody>{data.items.map(asset => <tr key={asset.id}>
            <td>{asset.code}</td><td>{asset.name}</td><td>{asset.type === 'movable' ? 'Mueble' : 'Inmueble'}</td>
            <td>{asset.location}</td><td>{asset.status === 'active' ? 'Activo' : 'De baja'}</td>
            <td><button onClick={() => void open(asset.id)} aria-label={`Ver bien ${asset.code}`}>Ver bien</button></td>
          </tr>)}</tbody></table></div>}
      <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button>
        <span>Página {page}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
    </>}
    <ErrorBox error={detailError} />
    {detailBusy && <Loading />}
    {detail && <Modal title={`${detail.asset.code} · ${detail.asset.name}`} onClose={() => { generation.current++; setDetail(undefined); setDetailBusy(false); setMovementBusy(false); setDetailError(undefined); setMovementError(undefined); }}>
      <dl className="treasury-receipt">
        <div><dt>Tipo</dt><dd>{detail.asset.type === 'movable' ? 'Mueble' : 'Inmueble'}</dd></div>
        <div><dt>Ubicación</dt><dd>{detail.asset.location}</dd></div>
        <div><dt>Condición</dt><dd>{detail.asset.condition}</dd></div>
        <div><dt>Existencia</dt><dd>{detail.asset.quantity}{detail.asset.unit ? ` ${detail.asset.unit}` : ''}</dd></div>
        <div><dt>Estado</dt><dd>{detail.asset.status === 'active' ? 'Activo' : 'De baja'}</dd></div>
        {detail.asset.category && <div><dt>Categoría</dt><dd>{detail.asset.category}</dd></div>}
        {detail.asset.responsible_name && <div><dt>Responsable</dt><dd>{detail.asset.responsible_name}</dd></div>}
        {detail.asset.description && <div><dt>Descripción</dt><dd>{detail.asset.description}</dd></div>}
      </dl>
      <PersonPhotos id={detail.asset.id} kind="asset" writable={detail.asset.status === 'active'} />
      <h3>Historial de movimientos</h3>
      <p role="status">{detail.movement_total} movimientos</p>
      <ErrorBox error={movementError} />
      {movementBusy && <Loading />}
      <div className="table-scroll"><table><thead><tr><th>N.º</th><th>Operación</th><th>Cambio</th><th>Existencia</th><th>Motivo</th><th>Responsable</th></tr></thead>
        <tbody>{detail.movements.map(item => <tr key={item.id}><td>{item.sequence}</td><td>{movementLabels[item.type] || item.type}</td>
          <td>{item.delta > 0 ? '+' : ''}{item.delta}</td><td>{item.quantity_after}</td><td>{item.reason}</td><td>{item.performer_name}</td></tr>)}</tbody></table></div>
      {detail.movement_total > detail.movement_page_size && <div className="pagination">
        <button disabled={movementBusy || detail.movement_page === 1} onClick={() => void movementPage(detail.movement_page - 1)}>Movimientos más recientes</button>
        <span>Página {detail.movement_page}</span>
        <button disabled={movementBusy || detail.movement_page * detail.movement_page_size >= detail.movement_total} onClick={() => void movementPage(detail.movement_page + 1)}>Movimientos más antiguos</button>
      </div>}
    </Modal>}
  </section>;
}
