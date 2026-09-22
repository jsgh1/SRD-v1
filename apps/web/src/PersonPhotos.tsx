import { useEffect, useState } from 'react';
import { api, canWrite, type Principal } from './api';
import { ErrorBox, Loading, Modal } from './ui';

type Photo = { slot: string; version: number; present: boolean; size: number; width: number | null; height: number | null };
const labels: Record<string, string> = { person: 'Foto de la persona', document: 'Foto del documento', property: 'Foto del predio' };

export function PersonPhotos({ id }: { id: string }) {
  const [photos, setPhotos] = useState<Photo[]>();
  const [write, setWrite] = useState(false);
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setPhotos(undefined); setError(undefined); setWrite(false);
    Promise.all([api<{items: Photo[]}>(`persons/${id}/photos`), api<Principal>('me')])
      .then(([data, principal]) => { if (active) { setPhotos(data.items); setWrite(canWrite(principal.role)); } })
      .catch(e => { if (active) setError(e); });
    return () => { active = false; };
  }, [id, revision]);
  return <section className="person-photos" aria-label="Fotografías de la ficha">
    <h3>Fotografías</h3>
    <p className="muted">JPEG, PNG o WebP de hasta 5 MB. Cada imagen se analiza antes de guardarla.</p>
    <ErrorBox error={error} />
    {error ? <button type="button" onClick={() => setRevision(r => r + 1)}>Reintentar fotografías</button> : !photos ? <Loading /> :
      <div className="photo-grid">{photos.map(photo => <PhotoCard key={`${id}-${photo.slot}`} id={id} initial={photo} writable={write} />)}</div>}
  </section>;
}

function PhotoCard({ id, initial, writable }: { id: string; initial: Photo; writable: boolean }) {
  const [photo, setPhoto] = useState(initial);
  const [src, setSrc] = useState<string>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const path = `persons/${id}/photos/${photo.slot}`;
  const label = labels[photo.slot];
  useEffect(() => {
    let active = true;
    setSrc(undefined);
    if (photo.present) api<{content: string; mime: string; version: number}>(path)
      .then(data => {
        if (!active) return;
        if (data.version !== photo.version) { setReloadRequired(true); setError(new Error('La fotografía cambió. Recarga antes de continuar.')); return; }
        setSrc(`data:image/png;base64,${data.content}`);
      }).catch(e => { if (active) { setError(e); setReloadRequired(true); } });
    return () => { active = false; };
  }, [path, photo.present, photo.version, revision]);

  async function reload() {
    setBusy(true); setError(undefined); setMessage(''); setConfirm(false); setSrc(undefined);
    try {
      const data = await api<{items: Photo[]}>(`persons/${id}/photos`);
      const current = data.items.find(p => p.slot === photo.slot);
      if (!current) throw new Error('No se pudo consultar la fotografía.');
      setPhoto(current); setReloadRequired(false); setRevision(r => r + 1);
    } catch (e) { setError(e); setReloadRequired(true); }
    finally { setBusy(false); }
  }
  async function save(file?: File) {
    if (!file) return;
    setError(undefined); setMessage('');
    if (!/\.(jpe?g|png|webp)$/i.test(file.name) || file.size > 5 * 1024 * 1024 || !file.size) {
      setError(new Error('Selecciona una imagen JPEG, PNG o WebP de hasta 5 MB.')); return;
    }
    setBusy(true); setConfirm(false);
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
      });
      const saved = await api<Photo>(path, 'PUT', { name: file.name, content, version: photo.version });
      setPhoto(saved); setMessage('Fotografía guardada.');
    } catch (e) { setError(e); setReloadRequired(true); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError(undefined); setMessage('');
    try { setPhoto(await api<Photo>(path, 'DELETE', { confirmed: true, version: photo.version })); setSrc(undefined); setMessage('Fotografía eliminada.'); }
    catch (e) { setError(e); setReloadRequired(true); }
    finally { setBusy(false); setConfirm(false); }
  }
  return <article className="photo-card" aria-label={label}>
    <h4>{label}</h4>
    {src ? <button type="button" className="photo-preview" aria-label={`Ampliar ${label.toLowerCase()}`} onClick={() => setExpanded(true)}><img src={src} alt={label} /></button>
      : <div className="photo-placeholder">{photo.present ? 'Vista previa no disponible todavía' : 'Sin fotografía'}</div>}
    {photo.present && <p className="muted">{photo.width} × {photo.height} px · {Math.ceil(photo.size / 1024)} KB</p>}
    <ErrorBox error={error} />
    {message && <p role="status">{message}</p>}
    {busy && <p role="status">Procesando fotografía… Espera la confirmación.</p>}
    <div className="photo-actions">
      <button type="button" disabled={busy} onClick={reload}>Recargar fotografía</button>
      {writable && <>
        <label className="photo-upload">{photo.present ? 'Reemplazar fotografía' : 'Agregar fotografía'}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || reloadRequired} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void save(file); }} />
        </label>
        {photo.present && <button type="button" disabled={busy || reloadRequired} onClick={() => setConfirm(true)}>Eliminar fotografía</button>}
      </>}
    </div>
    {confirm && <div className="photo-confirm"><p>¿Eliminar esta fotografía de la ficha?</p><button type="button" disabled={busy} onClick={remove}>Confirmar eliminación</button><button type="button" disabled={busy} onClick={() => setConfirm(false)}>Cancelar</button></div>}
    {expanded && src && <Modal title={label} onClose={() => setExpanded(false)}><img className="photo-full" src={src} alt={label} /></Modal>}
  </article>;
}
