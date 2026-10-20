import { useEffect, useState } from 'react';
import { api } from './api';
import { t, useLanguage } from './i18n';
import { ErrorBox, Loading } from './ui';

type Photo = { slot: string; version: number; present: boolean; size: number; width: number | null; height: number | null };

export function ProfilePhoto({ userId, personId }: { userId: string; personId?: string | null }) {
  useLanguage();
  const [photo, setPhoto] = useState<Photo>();
  const [src, setSrc] = useState<string>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [revision, setRevision] = useState(0);
  const target = personId ? `persons/${personId}/photos` : `users/${userId}/photos`;
  const slot = personId ? 'person' : 'avatar';
  const path = `${target}/${slot}`;

  useEffect(() => {
    let active = true;
    setPhoto(undefined); setSrc(undefined); setError(undefined);
    api<{items: Photo[]}>(target).then(async data => {
      const current = data.items.find(item => item.slot === slot);
      if (!current) throw new Error(t('No se pudo consultar la foto de perfil.'));
      const image = current.present ? await api<{content: string; mime: string; version: number}>(path) : null;
      if (!active) return;
      if (image && (image.mime !== 'image/png' || image.version !== current.version)) {
        throw new Error(t('La foto de perfil cambió. Recarga antes de continuar.'));
      }
      setPhoto(current);
      setSrc(image ? `data:image/png;base64,${image.content}` : undefined);
    }).catch(value => { if (active) setError(value); });
    return () => { active = false; };
  }, [path, revision, target, slot]);

  async function save(file?: File) {
    if (!file || !photo || busy) return;
    if (!/\.(jpe?g|png|webp)$/i.test(file.name) || file.size < 1 || file.size > 5 * 1024 * 1024) {
      setError(new Error(t('Selecciona una imagen JPEG, PNG o WebP de hasta 5 MB.'))); return;
    }
    setBusy(true); setError(undefined); setConfirm(false);
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error(t('No se pudo leer la imagen.')));
        reader.readAsDataURL(file);
      });
      await api<Photo>(path, 'PUT', { name: file.name, content, version: photo.version });
      setRevision(value => value + 1);
      window.dispatchEvent(new Event('srd-profile-photo-updated'));
      if (personId) window.dispatchEvent(new CustomEvent('srd-person-photo-updated', { detail: personId }));
    } catch (value) { setError(value); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!photo || busy) return;
    setBusy(true); setError(undefined);
    try {
      await api<Photo>(path, 'DELETE', { confirmed: true, version: photo.version });
      setConfirm(false); setRevision(value => value + 1);
      window.dispatchEvent(new Event('srd-profile-photo-updated'));
      if (personId) window.dispatchEvent(new CustomEvent('srd-person-photo-updated', { detail: personId }));
    } catch (value) { setError(value); }
    finally { setBusy(false); }
  }

  return <div className="profile-photo-settings">
    <h3>{t('Foto de perfil')}</h3>
    <p className="muted">{t('JPEG, PNG o WebP de hasta 5 MB. La foto se analiza antes de guardarse y solo se comparte dentro de esta junta.')}</p>
    <ErrorBox error={error} />
    {!!error && <button type="button" disabled={busy} onClick={() => setRevision(value => value + 1)}>{t('Reintentar foto de perfil')}</button>}
    {!photo && !error && <Loading />}
    {photo && <div className="profile-photo-controls">
      {src ? <img src={src} alt={t('Mi foto de perfil')} /> : <div className="profile-photo-empty">{t('Sin foto de perfil')}</div>}
      <div>
        <label className="photo-upload folder-file-label">{t(photo.present ? 'Reemplazar fotografía' : 'Agregar fotografía')}
          <input className="folder-file-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = ''; void save(file);
          }} />
          <span className="folder-file-picker" aria-hidden="true"><span className="folder-file-button">{t('Seleccionar archivo')}</span><span className="folder-file-name">{t('Ningún archivo seleccionado')}</span></span>
        </label>
        {photo.present && <button type="button" disabled={busy} onClick={() => setConfirm(true)}>{t('Eliminar foto de perfil')}</button>}
        {confirm && <div className="photo-confirm"><p>{t('¿Eliminar tu foto de perfil de esta junta?')}</p>
          <button type="button" disabled={busy} onClick={() => void remove()}>{t('Confirmar eliminación')}</button>
          <button type="button" disabled={busy} onClick={() => setConfirm(false)}>{t('Cancelar')}</button>
        </div>}
      </div>
    </div>}
  </div>;
}
