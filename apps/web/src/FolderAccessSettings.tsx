import { useEffect, useState, type FormEvent } from 'react';
import { api, roleNames } from './api';
import { ErrorBox, Loading } from './ui';
import { t, useLanguage } from './i18n';

type Grant = { id: string; version: number };
type FolderAccessValue = { version: number; reader_roles: string[]; reader_memberships: Grant[]; can_manage: boolean; can_read: boolean };
type Candidate = { id: string; version: number; name: string; email: string; role: string };
type Listing = { items: Candidate[]; total: number; page: number; page_size: number };
const delegableRoles = ['registrar', 'treasurer', 'auditor', 'viewer'] as const;
const sameIds = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export function FolderAccessSettings() {
  useLanguage();
  const [settings, setSettings] = useState<FolderAccessValue>();
  const [roles, setRoles] = useState<string[]>([]), [members, setMembers] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Listing>(), [known, setKnown] = useState<Record<string, Candidate>>({});
  const [searchText, setSearchText] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [revision, setRevision] = useState(0);
  const [error, setError] = useState<unknown>(), [status, setStatus] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(undefined);
    api<FolderAccessValue>('folder-access').then(async value => {
      if (!active) return;
      setSettings(value); setRoles(value.reader_roles);
      setMembers(value.reader_memberships.map(grant => grant.id));
      if (value.reader_memberships.length) {
        const params = new URLSearchParams();
        value.reader_memberships.forEach((grant, index) => params.set(`ids[${index}]`, grant.id));
        const selected = await api<Listing>(`members/folder-readers?${params}`);
        if (active) setKnown(current => ({ ...current, ...Object.fromEntries(selected.items.map(item => [item.id, item])) }));
      }
    }).catch(reason => { if (active) setError(reason); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    let active = true;
    api<Listing>(`members/folder-readers?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}`).then(value => {
      if (active) { setCandidates(value); setKnown(current => ({ ...current, ...Object.fromEntries(value.items.map(item => [item.id, item])) })); }
    }).catch(reason => { if (active) setError(reason); });
    return () => { active = false; };
  }, [page, search, revision]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!settings || saving) return;
    setSaving(true); setError(undefined); setStatus('');
    try {
      const value = await api<FolderAccessValue>('folder-access', 'PUT', {
        version: settings.version, reader_roles: roles, reader_memberships: members,
      });
      setSettings(value); setRoles(value.reader_roles); setMembers(value.reader_memberships.map(grant => grant.id));
      setStatus('Permisos de lectura de Carpeta guardados.');
    } catch (reason) { setError(reason); }
    finally { setSaving(false); }
  }
  const unchanged = !!settings && sameIds(roles, settings.reader_roles)
    && sameIds(members, settings.reader_memberships.map(grant => grant.id));
  return <section className="panel" aria-label={t('Permisos de lectura de Carpeta')}><h2>{t('Acceso a Carpeta')}</h2>
    <p>{t('Concede lectura por rol o por membresía activa de esta junta. Los permisos individuales caducan al cambiar la membresía. Solo Superadministrador y Administrador pueden crear, cambiar o eliminar contenido.')}</p>
    <ErrorBox error={error} /><p role="status">{t(status)}</p>
    {loading ? <Loading /> : <form onSubmit={save}>
      <h3>{t('Roles con lectura')}</h3><div className="form-grid">{delegableRoles.map(role => <label key={role} className="check-label">
        <input type="checkbox" disabled={saving} checked={roles.includes(role)} onChange={event => setRoles(current => event.target.checked ? [...current, role] : current.filter(value => value !== role))} />
        {t(roleNames[role])}</label>)}</div>
      <h3>{t('Personas con lectura individual')}</h3><p className="muted">{t('Hasta 20 membresías. Conceder lectura individual no permite escribir ni extiende el acceso a otras juntas.')}</p>
      <div className="actions"><input aria-label={t('Buscar miembro para Carpeta')} value={searchText} maxLength={120} onChange={event => setSearchText(event.target.value)} placeholder={t('Nombre o correo')} />
        <button type="button" disabled={saving} onClick={() => { setPage(1); setSearch(searchText.trim()); }}>{t('Buscar')}</button></div>
      {members.length > 0 && <div><p>{t('Seleccionados: {count}/20', { count: members.length })}</p><div className="actions">{members.map(id => {
        const grant = settings?.reader_memberships.find(item => item.id === id);
        const expired = grant && (!known[id] || known[id].version !== grant.version);
        return <button key={id} type="button" disabled={saving} onClick={() => setMembers(current => current.filter(value => value !== id))}
          aria-label={t('Quitar acceso individual de {name}', { name: known[id]?.name || id })}>
          {known[id]?.name || t('Membresía {id}', { id: id.slice(0, 8) })}{expired ? ` · ${t('permiso caducado')}` : ''} · {t('Quitar')}</button>;
      })}</div></div>}
      <div className="form-grid">{candidates?.items.map(candidate => <label key={candidate.id} className="check-label">
        <input type="checkbox" disabled={saving || (!members.includes(candidate.id) && members.length >= 20)} checked={members.includes(candidate.id)}
          onChange={event => setMembers(current => event.target.checked ? [...current, candidate.id] : current.filter(id => id !== candidate.id))} />
        {candidate.name} · {candidate.email} · {t(roleNames[candidate.role] ?? candidate.role)}</label>)}</div>
      {candidates?.items.length === 0 && <p className="muted">{t('No hay miembros activos con ese criterio.')}</p>}
      {candidates && candidates.total > 25 && <div className="actions"><button type="button" disabled={page <= 1 || saving} onClick={() => setPage(value => value - 1)}>{t('Anterior')}</button>
        <span>{t('Página {page} · {count} miembros', { page, count: candidates.total })}</span><button type="button" disabled={page * 25 >= candidates.total || saving} onClick={() => setPage(value => value + 1)}>{t('Siguiente')}</button></div>}
      <div className="actions"><button type="button" disabled={saving} onClick={() => setRevision(value => value + 1)}>{t('Actualizar permisos')}</button>
        <button className="primary" disabled={saving || !settings || unchanged}>{t(saving ? 'Guardando permisos…' : 'Guardar permisos')}</button></div>
    </form>}
  </section>;
}
