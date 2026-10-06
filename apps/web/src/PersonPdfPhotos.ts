export type PersonPdfPhoto = { slot: 'person' | 'document' | 'property'; version: number; dataUrl: string };
type PhotoStatus = { slot: string; version: number; present: boolean };
export const personPhotoLabels = { person: 'Foto de la persona', document: 'Foto del documento', property: 'Foto del predio' };

export async function loadPersonPdfPhotos(id: string, fetchData: <T>(path: string) => Promise<T>): Promise<PersonPdfPhoto[]> {
  const path = `persons/${id}/photos`;
  const before = await fetchData<{ items: PhotoStatus[] }>(path);
  const slots = Object.keys(personPhotoLabels);
  const valid = (items: PhotoStatus[]) => items.length === 3 && new Set(items.map(item => item.slot)).size === 3
    && items.every(item => slots.includes(item.slot) && Number.isInteger(item.version) && item.version >= 0 && typeof item.present === 'boolean');
  if (!valid(before.items)) throw new Error('No se pudo comprobar el estado de las fotografías.');
  const photos: PersonPdfPhoto[] = [];
  for (const slot of slots) {
    const photo = before.items.find(item => item.slot === slot)!;
    if (!photo.present) continue;
    const data = await fetchData<{ content: string; mime: string; version: number }>(`${path}/${slot}`);
    if (data.version !== photo.version) throw new Error('Una fotografía cambió durante la preparación. Reintenta la descarga.');
    if (data.mime !== 'image/png' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.content)
      || !atob(data.content).startsWith('\x89PNG\r\n\x1a\n')) throw new Error('La fotografía recibida no tiene un formato válido.');
    photos.push({ slot: slot as PersonPdfPhoto['slot'], version: photo.version, dataUrl: `data:image/png;base64,${data.content}` });
  }
  const after = await fetchData<{ items: PhotoStatus[] }>(path);
  if (!valid(after.items) || before.items.some(item => {
    const current = after.items.find(value => value.slot === item.slot);
    return current?.version !== item.version || current?.present !== item.present;
  })) throw new Error('Las fotografías cambiaron durante la preparación. Reintenta la descarga.');
  return photos;
}
