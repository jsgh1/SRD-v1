import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Empty, ErrorBox, Loading } from './ui';

type FileResult = { id: string; folder_id: string | null; folder_name: string | null; folder_path: string; name: string;
  mime: string; bytes: number; sha256: string; version: number };
type Listing = { items: FileResult[]; total: number; page_size: number };

export function FolderSearch({ query, onOpenFolder }: { query: string; onOpenFolder: (id?: string) => void }) {
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const [data, setData] = useState<Listing>(), [error, setError] = useState<unknown>();
  const [downloading, setDownloading] = useState<string>();
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    setData(undefined); setError(undefined);
    const params = new URLSearchParams({ q: query, page: String(page) });
    api<Listing>(`folder-documents/search?${params}`).then(value => { if (current) setData(value); })
      .catch(reason => { if (current) setError(reason); });
    return () => { current = false; };
  }, [query, page, retry]);
  async function download(item: FileResult) {
    if (downloading) return;
    setDownloading(item.id); setError(undefined);
    try {
      const result = await api<FileResult & { content: string }>(`folder-documents/${item.id}/download`);
      if (!active.current) return;
      if (result.id !== item.id || result.version !== item.version || result.name !== item.name
        || result.mime !== item.mime || result.bytes !== item.bytes || result.sha256 !== item.sha256)
        throw new Error('El archivo cambió. Repite la búsqueda antes de descargarlo.');
      const bytes = Uint8Array.from(atob(result.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
      const link = document.createElement('a'); link.href = url; link.download = result.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { if (active.current) setError(reason); }
    finally { if (active.current) setDownloading(undefined); }
  }
  return <section className="panel" aria-label="Resultados de archivos">
    <h2>Archivos de Carpeta</h2><p className="muted">Busca por nombre. Cada descarga vuelve a comprobar tu permiso y la integridad del archivo.</p>
    <ErrorBox error={error} />
    {error ? <button onClick={() => setRetry(value => value + 1)}>Reintentar archivos</button> : !data && <Loading />}
    {data && <><p role="status">{data.total} coincidencias en archivos</p>
      {data.items.length ? <div className="table-wrap"><table><thead><tr><th>Archivo</th><th>Ubicación</th><th>Acciones</th></tr></thead><tbody>
        {data.items.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.folder_path}</td><td><div className="actions">
          <button onClick={() => onOpenFolder(item.folder_id ?? undefined)} aria-label={`Abrir ubicación de ${item.name}`}>Abrir ubicación</button>
          <button disabled={!!downloading} onClick={() => void download(item)} aria-label={`Descargar ${item.name}`}>
            {downloading === item.id ? 'Descargando…' : 'Descargar'}</button></div></td></tr>)}</tbody></table></div>
        : <Empty title="Sin coincidencias en archivos">Prueba otro nombre de archivo.</Empty>}
      <div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button>
        <span>Página {page}</span><button disabled={page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>Siguiente</button></div></>}
  </section>;
}
