import { useEffect, useState, type FormEvent } from "react";
import {
  Eye,
  Pencil,
  Trash2,
  Search,
  ArrowLeft,
  Save,
  Plus,
} from "lucide-react";
import { api, canAdmin, canWrite, roleNames, type Principal } from "./api";
import { Empty, ErrorBox, Loading, Modal } from "./ui";
import { AdditionalInputs, AdditionalDetail, type FieldSchema } from './PersonFields';
import { PersonFilters, type ExtraFilter } from './PersonFilters';
import { type PositionCatalog } from './PersonPositions';
import { PersonPhotos } from './PersonPhotos';
import type { FilterSettings } from './PersonFilterSettings';
import { ExportFilename, addExportFilename, exportFilenameReady, safeXlsxFilename, type ExportFilenameChoice } from './ExportFilename';
import { Planilla } from './Planilla';
import type { PersonExportPdfData } from './PersonExportPdf';
import type { PersonIndividualPdfData } from './PersonIndividualPdf';
import { loadPersonPdfPhotos } from './PersonPdfPhotos';
import { formatLocale, localizedLabel, t, useLanguage } from './i18n';

export const documents: Record<string, string> = {
  RC: "Registro Civil",
  TI: "Tarjeta de Identidad",
  CC: "Cédula de Ciudadanía",
  CE: "Cédula de Extranjería",
  NIT: "NIT",
};
export const genders: Record<string, string> = {
  male: "Masculino",
  female: "Femenino",
  other: "Otro",
};
export const positions: Record<string, string> = {
  president: "Presidente",
  vicepresident: "Vicepresidente",
  secretary: "Secretario",
  treasurer: "Tesorero",
  fiscal: "Fiscal",
  other: "Otro",
};
export type Person = Record<string, any> & {
  id: string;
  first_names: string;
  last_names: string;
  document_type: string;
  document_number: string;
  status: string;
  version: number;
};
type Workbook = { filename: string; mime: string; content: string; count: number };
type PersonExportJob = { id: string; status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired'; format: 'xlsx' | 'pdf'; count: number; cutoff_at: string; filename: string; ticket?: string };
export function Status({ value }: { value: string }) {
  return (
    <span className={"status " + value}>
      {t(value === 'complete' ? 'Completado' : 'Pendiente')}
    </span>
  );
}
export function PersonTable({
  rows,
  onView,
  onEdit,
  onDelete,
}: {
  rows: Person[];
  onView: (p: Person) => void;
  onEdit?: (p: Person) => void;
  onDelete?: (p: Person) => void;
}) {
  useLanguage();
  return (
    <><div className="table-scroll person-desktop-table">
      <table>
        <thead>
          <tr>
            <th>{t('Nombre')}</th>
            <th>{t('Documento')}</th>
            <th>{t('Fecha de registro')}</th>
            <th>{t('Estado')}</th>
            <th>{t('Acciones')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>
                  {p.first_names} {p.last_names}
                </strong>
              </td>
              <td>
                <span className="muted">{p.document_type}</span>{" "}
                {p.document_number}
              </td>
              <td>
                {new Date(
                  p.created_at.replace(" ", "T") + "Z",
                ).toLocaleDateString(formatLocale(), { timeZone: "America/Bogota" })}
              </td>
              <td>
                <Status value={p.status} />
              </td>
              <td>
                <div className="actions">
                  <button
                    className="icon-button"
                    title={t('Ver detalle')}
                    aria-label={t('Ver {name}', {name: p.first_names})}
                    onClick={() => onView(p)}
                  >
                    <Eye size={18} />
                  </button>
                  {onEdit && (
                    <button
                      className="icon-button"
                      aria-label={t('Editar {name}', {name: p.first_names})}
                      onClick={() => onEdit(p)}
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="icon-button danger"
                      aria-label={t('Eliminar {name}', {name: p.first_names})}
                      onClick={() => onDelete(p)}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ul className="person-mobile-list" aria-label={t('Lista de personas')}>
      {rows.map(p => <li className="person-mobile-card" key={p.id}>
        <div className="person-mobile-heading"><strong>{p.first_names} {p.last_names}</strong><Status value={p.status} /></div>
        <dl>
          <div><dt>{t('Documento')}</dt><dd>{p.document_type} {p.document_number}</dd></div>
          <div><dt>{t('Fecha de registro')}</dt><dd>{new Date(p.created_at.replace(' ', 'T') + 'Z').toLocaleDateString(formatLocale(), { timeZone: 'America/Bogota' })}</dd></div>
        </dl>
        <div className="person-mobile-actions">
          <button type="button" aria-label={t('Ver {name}', { name: p.first_names })} onClick={() => onView(p)}><Eye size={16} aria-hidden="true" />{t('Ver detalle')}</button>
          {onEdit && <button type="button" aria-label={t('Editar {name}', { name: p.first_names })} onClick={() => onEdit(p)}><Pencil size={16} aria-hidden="true" />{t('Editar')}</button>}
          {onDelete && <button type="button" className="danger" aria-label={t('Eliminar {name}', { name: p.first_names })} onClick={() => onDelete(p)}><Trash2 size={16} aria-hidden="true" />{t('Eliminar')}</button>}
        </div>
      </li>)}
    </ul></>
  );
}
export function PersonDetail({
  id,
  onClose,
  principal,
}: {
  id: string;
  onClose: () => void;
  principal: Principal;
}) {
  const language = useLanguage();
  const [person, setPerson] = useState<Person>(),
    [error, setError] = useState<unknown>();
  const [detailRevision, setDetailRevision] = useState(0);
  const [portrait, setPortrait] = useState<string>();
  const [individualName, setIndividualName] = useState<ExportFilenameChoice>({ name: '', confirmed: false });
  const [individualBusy, setIndividualBusy] = useState(false), [individualError, setIndividualError] = useState<unknown>();
  const [includePdfPhotos, setIncludePdfPhotos] = useState(false);
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<unknown>();
  const [inviteNotice, setInviteNotice] = useState('');
  useEffect(() => {
    setPerson(undefined); setError(undefined); setIndividualError(undefined);
    setIndividualName({ name: '', confirmed: false });
    setIncludePdfPhotos(false);
    let active = true;
    api("persons/" + id)
      .then(data => { if (active) setPerson(data); })
      .catch(value => { if (active) setError(value); });
    return () => { active = false; };
  }, [id, detailRevision]);
  async function invitePerson() {
    if (!person?.email || inviteBusy) return;
    setInviteBusy(true); setInviteError(undefined); setInviteNotice('');
    try {
      await api('invitations', 'POST', { person_id: id, email: person.email, role: inviteRole });
      setInviteNotice('Invitación creada. La persona recibirá un correo para activar su cuenta.');
    } catch (cause) { setInviteError(cause); }
    finally { setInviteBusy(false); }
  }
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const photos = await api<{items: {slot: string; present: boolean}[]}>(`persons/${id}/photos`);
        if (!photos.items.some(photo => photo.slot === 'person' && photo.present)) { if (active) setPortrait(undefined); return; }
        const image = await api<{content: string; mime: string}>(`persons/${id}/photos/person`);
        if (active) setPortrait(image.mime === 'image/png' ? `data:image/png;base64,${image.content}` : undefined);
      } catch { if (active) setPortrait(undefined); }
    };
    const updated = (event: Event) => { if ((event as CustomEvent<string>).detail === id) void load(); };
    setPortrait(undefined);
    void load();
    window.addEventListener('srd-person-photo-updated', updated);
    return () => { active = false; window.removeEventListener('srd-person-photo-updated', updated); };
  }, [id]);
  async function downloadIndividual(format: 'xlsx' | 'pdf' = 'xlsx') {
    if (!person || individualBusy || !exportFilenameReady(individualName)) return;
    setIndividualBusy(true); setIndividualError(undefined);
    try {
      const params = new URLSearchParams();
      addExportFilename(params, individualName);
      params.set('language', language);
      if (format === 'pdf') {
        const photos = includePdfPhotos ? await loadPersonPdfPhotos(id, api) : undefined;
        const data = await api<PersonIndividualPdfData>(`persons/${id}/pdf?${params}`);
        const { downloadPersonIndividualPdf } = await import('./PersonIndividualPdf');
        await downloadPersonIndividualPdf(data, photos);
        return;
      }
      const file = await api<Workbook>(`persons/${id}/xlsx?${params}`);
      if (!safeXlsxFilename(file.filename) || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') throw new Error(t('La exportación no tiene un formato válido.'));
      const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { setIndividualError(value); }
    finally { setIndividualBusy(false); }
  }
  const labels: Record<string, string> = {
    document_type: "Tipo de documento",
    document_number: "Número de documento",
    zone: "Zona",
    affiliated: "Afiliación",
    gender: "Género",
    birth_date: "Fecha de nacimiento",
    phone: "Teléfono",
    email: "Correo electrónico",
    position_code: "Cargo",
    descriptive_role: "Rol en la comunidad",
    property_name: "Predio",
    address: "Dirección",
    neighborhood: "Barrio",
  };
  function value(key: string, v: any) {
    if (v === null || v === undefined || v === "") return t('Sin registrar');
    if (key === "affiliated") return t(v ? 'Sí' : 'No');
    if (key === "document_type") return t(documents[v] || v);
    if (key === "gender") return t(genders[v] || v);
    if (key === "position_code") return person?.position_label
      ? localizedLabel({label: person.position_label, label_en: person.position_label_en})
      : t(positions[v] || v);
    if (key === "descriptive_role") return t(roleNames[v] || v);
    if (key === "zone") return t(v === "rural" ? "Rural" : "Urbana");
    return String(v);
  }
  return (
    <Modal title={t('Detalle de persona')} onClose={onClose}>
      <ErrorBox error={error} />
      {!!error && <button type="button" onClick={() => setDetailRevision(value => value + 1)}>{t('Reintentar detalle')}</button>}
      {!person && !error ? (
        <Loading />
      ) : (
        person && (
          <>
            <div className="person-title">
              <span className="avatar person-detail-avatar">{portrait ? <img src={portrait} alt={t('Foto de la persona')} /> : person.first_names.slice(0, 1)}</span>
              <div>
                <h3>
                  {person.first_names} {person.last_names}
                </h3>
                <Status value={person.status} />
              </div>
            </div>
            <dl className="details">
              {Object.entries(labels).map(([key, label]) => (
                <div key={key}>
                  <dt>{t(label)}</dt>
                  <dd>{value(key, person[key])}</dd>
                </div>
              ))}
            </dl>
            {"note" in person && (
              <section className="internal-note">
                <h3>{t('Nota interna')}</h3>
                <p>{person.note || t('Sin nota interna.')}</p>
              </section>
            )}
            <AdditionalDetail values={person.custom_fields} />
            {canWrite(principal.role) && <section className="person-invite">
              <h3>{t('Acceso al sistema')}</h3>
              <p className="muted">{t('Invita a esta persona con el correo guardado en su ficha. La invitación le permitirá crear su contraseña.')}</p>
              {person.email ? <div className="actions">
                <label>{t('Rol de acceso')}
                  <select value={inviteRole} onChange={event => setInviteRole(event.target.value)}>
                    {(principal.role === 'registrar' ? ['viewer'] : ['viewer', 'registrar', 'treasurer', 'auditor', 'admin']).map(role =>
                      <option key={role} value={role}>{t(roleNames[role])}</option>)}
                  </select>
                </label>
                <button type="button" disabled={inviteBusy} onClick={() => void invitePerson()}>{t('Enviar invitación')}</button>
              </div> : <p className="muted">{t('Agrega un correo a la ficha antes de invitar.')}</p>}
              <ErrorBox error={inviteError} />
              {inviteNotice && <p className="notice" role="status">{t(inviteNotice)}</p>}
            </section>}
            <section aria-label={t('Exportar ficha individual')}>
              <h3>{t('Descargar ficha')}</h3>
              <p className="muted">{t('Incluye los datos base y campos adicionales guardados. No incluye notas internas ni autorizaciones. Excel contiene solo texto.')}</p>
              <label className="check-label"><input type="checkbox" checked={includePdfPhotos} disabled={individualBusy} onChange={event => setIncludePdfPhotos(event.target.checked)} />{t('Incluir fotografías en el PDF')}</label>
              <ExportFilename value={individualName} onChange={setIndividualName} type="ficha_persona" />
              <ErrorBox error={individualError} />
              <button type="button" disabled={individualBusy || !exportFilenameReady(individualName)} onClick={() => void downloadIndividual()}>{t(individualBusy ? 'Preparando ficha…' : 'Descargar ficha Excel')}</button>
              <button type="button" disabled={individualBusy || !exportFilenameReady(individualName)} onClick={() => void downloadIndividual('pdf')}>{t(individualBusy ? 'Preparando ficha…' : 'Descargar ficha PDF')}</button>
            </section>
            <PersonPhotos key={id} id={id} />
            <p className="muted">
              {t('Versión {version} · El rol de acceso se concede con una invitación.', {version: person.version})}
            </p>
          </>
        )
      )}
    </Modal>
  );
}
type BaseFilters = { document_type: string; gender: string; descriptive_role: string; position_code: string; birth_date_from: string; birth_date_to: string; registered_from: string; registered_to: string };
const emptyBaseFilters: BaseFilters = { document_type: '', gender: '', descriptive_role: '', position_code: '', birth_date_from: '', birth_date_to: '', registered_from: '', registered_to: '' };

function BasePersonFilters({ value, onChange, visible }: { value: BaseFilters; onChange: (value: BaseFilters) => void; visible: string[] }) {
  const [catalog, setCatalog] = useState<PositionCatalog>(), [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!visible.includes('position_code')) return;
    let active = true;
    setError(undefined); setCatalog(undefined);
    api<PositionCatalog>('person-positions').then(data => { if (active) setCatalog(data); }).catch(e => { if (active) setError(e); });
    return () => { active = false; };
  }, [revision, visible]);
  const select = (key: keyof BaseFilters, label: string, options: Record<string, string>) => visible.includes(key) ? <label>{t(label)}
    <select value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })}>
      <option value="">{t('Todos')}</option>{Object.entries(options).map(([code, name]) => <option key={code} value={code}>{t(name)}</option>)}
    </select></label> : null;
  if (!Object.keys(emptyBaseFilters).some(key=>visible.includes(key)) && !visible.includes('birth_date') && !visible.includes('registered_at')) return null;
  return <fieldset className="person-extra-filters"><legend>{t('Más filtros de la ficha')}</legend>
    <div className="person-extra-filter">
      {select('document_type', 'Tipo de documento', documents)}
      {select('gender', 'Género', genders)}
      {select('descriptive_role', 'Rol en la comunidad', Object.fromEntries(Object.entries(roleNames).filter(([code]) => code !== 'superadmin')))}
      {visible.includes('position_code') && <label>{t('Cargo')}<select value={value.position_code} disabled={!catalog} onChange={e => onChange({ ...value, position_code: e.target.value })}>
        <option value="">{catalog ? t('Todos') : t('Cargando cargos…')}</option>
        {catalog?.items.map(item => <option key={item.code} value={item.code}>{localizedLabel(item)}{item.active ? '' : ` ${t('(inactivo)')}`}</option>)}
      </select></label>}
      {visible.includes('birth_date') && <><label>{t('Nacimiento desde')}<input type="date" required={!!value.birth_date_to} max={value.birth_date_to || undefined} value={value.birth_date_from} onChange={e=>onChange({...value,birth_date_from:e.target.value})}/></label><label>{t('Nacimiento hasta')}<input type="date" required={!!value.birth_date_from} min={value.birth_date_from || undefined} value={value.birth_date_to} onChange={e=>onChange({...value,birth_date_to:e.target.value})}/></label></>}
      {visible.includes('registered_at') && <><label>{t('Registro desde')}<input type="date" required={!!value.registered_to} max={value.registered_to || undefined} value={value.registered_from} onChange={e=>onChange({...value,registered_from:e.target.value})}/></label><label>{t('Registro hasta')}<input type="date" required={!!value.registered_from} min={value.registered_from || undefined} value={value.registered_to} onChange={e=>onChange({...value,registered_to:e.target.value})}/></label></>}
    </div>
    <p className="muted">{t('Todos los criterios deben coincidir. Cargo y rol describen la ficha, no los permisos de una cuenta. También puedes buscar cargos inactivos.')}</p>
    <ErrorBox error={error} />{!!error && <button type="button" onClick={() => setRevision(r => r + 1)}>{t('Reintentar cargos')}</button>}
  </fieldset>;
}

export function Persons({
  principal,
  mode,
  onCreate,
  openExportJobId,
  onExportOpened,
}: {
  principal: Principal;
  mode: "list" | "lookup";
  onCreate: () => void;
  openExportJobId?: string;
  onExportOpened?: () => void;
}) {
  const language = useLanguage();
  const [result, setResult] = useState<any>(),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [zone, setZone] = useState(""),
    [affiliated, setAffiliated] = useState(""),
    [baseFilters, setBaseFilters] = useState<BaseFilters>(emptyBaseFilters),
    [customFilters, setCustomFilters] = useState<ExtraFilter[]>([]),
    [advancedOpen, setAdvancedOpen] = useState(false),
    [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [applied, setApplied] = useState(""),
    [error, setError] = useState<unknown>(),
    [detail, setDetail] = useState<string>(),
    [edit, setEdit] = useState<Person>(),
    [remove, setRemove] = useState<Person>(),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState<unknown>();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportJob, setExportJob] = useState<PersonExportJob>();
  const jobStorageKey = `srd-person-export:${principal.organization.id}:${principal.user_id}`;
  const [exportName, setExportName] = useState<ExportFilenameChoice>({ name: '', confirmed: false });
  const [filterSettings,setFilterSettings]=useState<FilterSettings>(), [filterError,setFilterError]=useState<unknown>(), [filterRevision,setFilterRevision]=useState(0);
  useEffect(() => {
    if (mode !== 'list') return;
    const id = openExportJobId || localStorage.getItem(jobStorageKey);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    if (openExportJobId) localStorage.setItem(jobStorageKey, openExportJobId);
    let active = true;
    void api<PersonExportJob>(`persons/export-jobs/${id}`)
      .then(value => { if (active) { setExportJob(value); if (openExportJobId) onExportOpened?.(); } })
      .catch(() => { if (active) { localStorage.removeItem(jobStorageKey); if (openExportJobId) onExportOpened?.(); } });
    return () => { active = false; };
  }, [jobStorageKey, mode, openExportJobId]);
  useEffect(() => {
    if (!exportJob || !['queued', 'processing'].includes(exportJob.status)) return;
    let active = true;
    const timer = setTimeout(() => {
      void api<PersonExportJob>(`persons/export-jobs/${exportJob.id}`)
        .then(value => { if (active) setExportJob(value); })
        .catch(value => { if (active) setExportError(value); });
    }, 5000);
    return () => { active = false; clearTimeout(timer); };
  }, [exportJob]);
  useEffect(()=>{
    if(mode !== 'list') return;
    let active=true;
    setFilterSettings(undefined); setFilterError(undefined); setApplied(''); setPage(1);
    setStatus(''); setZone(''); setAffiliated(''); setBaseFilters(emptyBaseFilters); setCustomFilters([]);
    api<FilterSettings>('person-filter-settings').then(value=>{if(active)setFilterSettings(value);}).catch(e=>{if(active)setFilterError(e);});
    return ()=>{active=false;};
  },[mode,filterRevision]);
  useEffect(() => {
    if (mode !== "list") {
      setResult(undefined);
      return;
    }
    setResult(undefined);
    setError(undefined);
    let active = true;
    api(`persons?page=${page}&page_size=${size}&${applied}`)
      .then(value => { if (active) setResult(value); })
      .catch(error => { if (active) setError(error); });
    return () => { active = false; };
  }, [mode, page, size, applied, refresh]);
  async function exportExcel() {
    if (exporting) return;
    setExporting(true); setExportError(undefined);
    try {
      const params = new URLSearchParams(applied);
      addExportFilename(params, exportName);
      params.set('language', language);
      if (result.total > 500) {
        const queued = await api<PersonExportJob>(`persons/export-jobs?${params}`, 'POST');
        setExportJob(queued);
        localStorage.setItem(jobStorageKey, queued.id);
        return;
      }
      const file = await api<Workbook>(`persons/export?${params}`);
      if (!safeXlsxFilename(file.filename)
        || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        throw new Error(t('La exportación no tiene un formato válido.'));
      }
      const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { setExportError(value); }
    finally { setExporting(false); }
  }
  async function downloadExportJob() {
    if (!exportJob || exportJob.status !== 'ready') return;
    setExportError(undefined);
    try {
      // Cada consulta emite un enlace nuevo de 15 minutos; el permiso se comprueba también al descargar.
      const current = await api<PersonExportJob>(`persons/export-jobs/${exportJob.id}`);
      setExportJob(current);
      if (!current.ticket) throw new Error(t('El archivo ya no está disponible.'));
      if (current.format === 'pdf') {
        const data = await api<PersonExportPdfData | Workbook>(`persons/export-jobs/${current.id}/download?ticket=${current.ticket}`);
        if ('content' in data) {
          if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.pdf$/.test(data.filename)
            || data.mime !== 'application/pdf' || data.count !== current.count) {
            throw new Error(t('La exportación no tiene un formato válido.'));
          }
          const bytes = Uint8Array.from(atob(data.content), char => char.charCodeAt(0));
          if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') {
            throw new Error(t('La exportación no tiene un formato válido.'));
          }
          const url = URL.createObjectURL(new Blob([bytes], { type: data.mime }));
          const link = document.createElement('a');
          link.href = url; link.download = data.filename;
          document.body.append(link); link.click(); link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          const { downloadPersonExportPdf } = await import('./PersonExportPdf');
          await downloadPersonExportPdf(data, principal.organization.name);
        }
        return;
      }
      const file = await api<Workbook>(`persons/export-jobs/${current.id}/download?ticket=${current.ticket}`);
      if (!safeXlsxFilename(file.filename)
        || file.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        throw new Error(t('La exportación no tiene un formato válido.'));
      }
      const bytes = Uint8Array.from(atob(file.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
      const link = document.createElement('a');
      link.href = url; link.download = file.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { setExportError(value); }
  }
  async function exportPdf() {
    if (exportingPdf) return;
    setExportingPdf(true); setExportError(undefined);
    try {
      const params = new URLSearchParams(applied);
      addExportFilename(params, exportName);
      params.set('language', language);
      if (result.total > 500) {
        params.set('format', 'pdf');
        const queued = await api<PersonExportJob>(`persons/export-jobs?${params}`, 'POST');
        setExportJob(queued);
        localStorage.setItem(jobStorageKey, queued.id);
        return;
      }
      const data = await api<PersonExportPdfData>(`persons/export-pdf?${params}`);
      const { downloadPersonExportPdf } = await import('./PersonExportPdf');
      await downloadPersonExportPdf(data, principal.organization.name);
    } catch (value) { setExportError(value); }
    finally { setExportingPdf(false); }
  }
  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPage(1);
    if (mode === "list") {
      const criteria={status,zone,affiliated,...baseFilters};
      const params = new URLSearchParams({ q: query });
      Object.entries(criteria).forEach(([key,value])=>{if(filterSettings?.base.includes(key))params.set(key,value);});
      if(filterSettings?.base.includes('birth_date') && baseFilters.birth_date_from && baseFilters.birth_date_to) {
        params.set('birth_date_from',baseFilters.birth_date_from);
        params.set('birth_date_to',baseFilters.birth_date_to);
      }
      if(filterSettings?.base.includes('registered_at') && baseFilters.registered_from && baseFilters.registered_to) {
        params.set('registered_from',baseFilters.registered_from);
        params.set('registered_to',baseFilters.registered_to);
      }
      customFilters.forEach((filter, index) => {
        params.set(`custom_filters[${index}][field_id]`, filter.field_id);
        params.set(`custom_filters[${index}][value]`, filter.value);
        if (filter.operator === 'between') {
          params.set(`custom_filters[${index}][operator]`, 'between');
          params.set(`custom_filters[${index}][value_to]`, filter.value_to ?? '');
        }
      });
      setApplied(params.toString());
      setRefresh(value => value + 1);
    } else {
      setBusy(true);
      setResult(undefined);
      try {
        const data = await api(
          "persons/lookup?" +
            new URLSearchParams(
              Object.fromEntries(
                new FormData(e.target as HTMLFormElement),
              ) as Record<string, string>,
            ),
        );
        setResult({ items: data.id ? [data] : [], total: data.id ? 1 : 0 });
      } catch (e) {
        setError(e);
      } finally {
        setBusy(false);
      }
    }
  }
  async function editPerson(p: Person) {
    try {
      setEdit(await api("persons/" + p.id));
    } catch (e) {
      setError(e);
    }
  }
  async function deletePerson() {
    if (!remove) return;
    setBusy(true);
    try {
      await api("persons/" + remove.id, "DELETE", {
        confirmed: true,
        version: remove.version,
      });
      setRemove(undefined);
      setRefresh(refresh + 1);
    } catch (e) {
      setError(e);
      setRemove(undefined);
    } finally {
      setBusy(false);
    }
  }
  if (edit)
    return (
      <PersonForm
        principal={principal}
        initial={edit}
        onSaved={() => {
          setEdit(undefined);
          setRefresh(refresh + 1);
        }}
        onBack={() => setEdit(undefined)}
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t(mode === "list" ? "Lista de personas" : "Consultar persona")}</h1>
          <p className="muted">
            {t(mode === "list"
              ? "Encuentra y mantén al día los registros de tu junta."
              : "Busca una ficha por su tipo y número de documento.")}
          </p>
        </div>
        {canWrite(principal.role) && (
          <button className="primary" onClick={onCreate}>
            <Plus size={18} />
            {t('Nuevo registro')}
          </button>
        )}
      </div>
      <ErrorBox error={error} />
      {mode === 'list' && error && <div className="actions"><button type="button" onClick={() => setRefresh(value => value + 1)}>{t('Reintentar personas')}</button></div>}
      <section className="panel">
        <form className="filters" onSubmit={search} aria-label={t('Filtros de personas')}>
          {mode === "list" ? (
            <>
              <label className="grow">
                {t('Buscar')}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('Nombre, apellido o documento')}
                />
              </label>
              {filterSettings?.base.includes('status') && <label>
                {t('Estado')}
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">{t('Todos')}</option>
                  <option value="pending">{t('Pendiente')}</option>
                  <option value="complete">{t('Completado')}</option>
                </select>
              </label>}
              {filterSettings?.base.includes('zone') && <label>
                {t('Zona')}
                <select value={zone} onChange={(e) => setZone(e.target.value)}>
                  <option value="">{t('Todas')}</option>
                  <option value="rural">{t('Rural')}</option>
                  <option value="urban">{t('Urbana')}</option>
                </select>
              </label>}
              {filterSettings?.base.includes('affiliated') && <label>{t('Afiliación')}<select value={affiliated} onChange={e => setAffiliated(e.target.value)}><option value="">{t('Todas')}</option><option value="1">{t('Afiliados')}</option><option value="0">{t('No afiliados')}</option></select></label>}
              {filterSettings ? <details className="person-advanced" open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
                <summary>{t('Más filtros de la ficha')}{(Object.values(baseFilters).some(Boolean) || customFilters.length > 0) && <span className="person-advanced-active">{t('Filtros seleccionados')}</span>}</summary>
                <BasePersonFilters value={baseFilters} onChange={setBaseFilters} visible={filterSettings.base} />
                <PersonFilters value={customFilters} onChange={setCustomFilters} allowed={filterSettings.custom} />
              </details> : filterError ? <div className="person-extra-filters"><ErrorBox error={filterError}/><button type="button" onClick={()=>setFilterRevision(v=>v+1)}>{t('Reintentar configuración de filtros')}</button></div> : <Loading/>}
            </>
          ) : (
            <>
              <label>
                {t('Tipo de documento')}
                <select name="document_type">
                  {Object.entries(documents).map(([v, l]) => (
                    <option value={v} key={v}>
                      {t(l)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grow">
                {t('Número de documento')}
                <input name="document_number" required maxLength={30} placeholder={t('Ej.: 1234567890')} />
              </label>
            </>
          )}
          <button className="primary" disabled={busy}>
            <Search size={18} />
            {t(mode === "list" ? "Aplicar filtros" : "Consultar")}
          </button>
          {mode === 'list' && <button type="button" onClick={() => { setQuery(''); setStatus(''); setZone(''); setAffiliated(''); setBaseFilters(emptyBaseFilters); setCustomFilters([]); setAdvancedOpen(false); setPage(1); setApplied(''); setRefresh(value => value + 1); }}>{t('Limpiar filtros')}</button>}
        </form>
        {mode === 'lookup' && busy ? <Loading /> : result ? (
          <>
            {result.items.length ? (
              <PersonTable
                rows={result.items}
                onView={(p) => setDetail(p.id)}
                onEdit={canWrite(principal.role) ? editPerson : undefined}
                onDelete={canAdmin(principal.role) ? setRemove : undefined}
              />
            ) : (
              <Empty title={t('No encontramos registros')}>
                {t('Prueba con otros criterios o crea el primer registro de tu junta.')}
              </Empty>
            )}
            <div className="pagination person-results-pagination">
              <span>{t('{count} registros encontrados', {count: result.total})}</span>
              {mode === "list" && (
                <>
                  <label>
                    {t('Filas')}
                    <select
                      aria-label={t('Filas por página')}
                      value={size}
                      onChange={(e) => {
                        setSize(+e.target.value);
                        setPage(1);
                      }}
                    >
                      {[10, 25, 50].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    {t('Anterior')}
                  </button>
                  <span>{t('Página {page}', {page})}</span>
                  <button
                    disabled={page * size >= result.total}
                    onClick={() => setPage(page + 1)}
                  >
                    {t('Siguiente')}
                  </button>
                </>
              )}
            </div>
          </>
        ) : mode === "list" ? (
          error ? null : <Loading />
        ) : error ? null : (
          <Empty title={t('Consulta exacta')}>
            {t('Completa los dos campos para buscar.')}
          </Empty>
        )}
        {mode === 'list' && <div className="person-exports">
          <section aria-label={t('Exportación de personas')}>
            <h2>{t('Exportación de personas')}</h2>
            <ExportFilename value={exportName} onChange={setExportName} type="personas" />
            <ErrorBox error={exportError} />
            {exportJob && <div className="notice" role="status">
              <strong>{t(exportJob.status === 'queued' ? 'En cola' : exportJob.status === 'processing' ? 'Procesando' : exportJob.status === 'ready' ? 'Lista para descargar' : exportJob.status === 'expired' ? 'Vencida' : 'Fallida')}</strong>
              <span> · {exportJob.count} {t('personas')} · {t('Corte')}: {new Date(exportJob.cutoff_at).toLocaleString(formatLocale(), { timeZone: 'America/Bogota' })}</span>
              {exportJob.status === 'ready' && <button type="button" onClick={() => void downloadExportJob()}>{t(exportJob.format === 'pdf' ? 'Descargar PDF preparado' : 'Descargar Excel preparado')}</button>}
              {exportJob.status === 'expired' && <p>{t('El archivo venció después de 24 horas. Exporta de nuevo para crear otro.')}</p>}
              {exportJob.status !== 'ready' && exportJob.status !== 'expired' && <button type="button" onClick={() => void api<PersonExportJob>(`persons/export-jobs/${exportJob.id}`).then(setExportJob).catch(setExportError)}>{t('Actualizar estado')}</button>}
            </div>}
            <div className="pagination"><button type="button" disabled={busy || exporting || exportingPdf || !result || result.total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportExcel()}>{t(exporting ? 'Preparando Excel…' : 'Exportar Excel')}</button><button type="button" disabled={busy || exporting || exportingPdf || !result || result.total > 2000 || !exportFilenameReady(exportName)} onClick={() => void exportPdf()}>{t(exportingPdf ? 'Preparando PDF…' : 'Exportar PDF')}</button><span className="export-help">{t('Descarga hasta 2000 personas según los filtros, sin notas ni fotografías.')}</span></div>
          </section>
          <Planilla applied={applied} total={result?.total} busy={busy} organizationName={principal.organization.name} />
        </div>}
      </section>
      {detail && (
        <PersonDetail id={detail} principal={principal} onClose={() => setDetail(undefined)} />
      )}
      {remove && (
        <Modal title={t('Eliminar registro')} onClose={() => setRemove(undefined)}>
          <p>
            {t('Se eliminará el registro de')} {" "}
            <strong>
              {remove.first_names} {remove.last_names}
            </strong>
            {t('. Esta acción no puede deshacerse desde el sistema.')}
          </p>
          <div className="actions end">
            <button onClick={() => setRemove(undefined)}>{t('Cancelar')}</button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={deletePerson}
            >
              {t('Sí, eliminar')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function PersonForm({
  principal,
  initial,
  onSaved,
  onBack,
}: {
  principal: Principal;
  initial?: Person;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [zone, setZone] = useState(initial?.zone || ""),
    [status, setStatus] = useState(initial?.status || "pending"),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [clear, setClear] = useState(false),
    [formKey, setFormKey] = useState(0),
    [changeZone, setChangeZone] = useState<string | null>(null);
  const complete = status === "complete";
  const [schema, setSchema] = useState<FieldSchema>(), [schemaError, setSchemaError] = useState<unknown>(), [schemaBusy, setSchemaBusy] = useState(false);
  const [catalog, setCatalog] = useState<PositionCatalog>();
  const [createdId, setCreatedId] = useState<string>();
  const [inviteAccess, setInviteAccess] = useState(false);
  const [inviteFailure, setInviteFailure] = useState<{person_id: string; email: string; role: string}>();
  const [inviteNotice, setInviteNotice] = useState('');
  async function retryInvitation() {
    if (!inviteFailure) return;
    setBusy(true); setError(undefined);
    try {
      await api('invitations', 'POST', inviteFailure);
      setInviteFailure(undefined);
      setInviteNotice('Invitación creada. La persona recibirá un correo para activar su cuenta.');
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  }
  async function loadSchema() {
    setSchemaBusy(true); setSchemaError(undefined);
    try { const [fields, cargos] = await Promise.all([api<FieldSchema>('person-fields'), api<PositionCatalog>('person-positions')]); setSchema(fields); setCatalog(cargos); } catch (e) { setSchemaError(e); }
    finally { setSchemaBusy(false); }
  }
  useEffect(() => { loadSchema(); }, []);
  function todayInBogota() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function field(
    name: string,
    label: string,
    type = "text",
    required = false,
    max = 120,
  ) {
    const examples: Record<string, string> = {
      document_number: 'Ej.: 1234567890',
      first_names: 'Ej.: María Elena',
      last_names: 'Ej.: Pérez López',
      phone: 'Ej.: 300 123 4567',
      email: 'nombre@ejemplo.com',
    };
    return (
      <label>
        {t(label)}
        {required ? " *" : ""}
        <input
          name={name}
          type={type}
          defaultValue={initial?.[name] ?? ""}
          required={required}
          maxLength={max}
          max={name === 'birth_date' ? todayInBogota() : undefined}
          placeholder={examples[name] ? t(examples[name]) : undefined}
        />
      </label>
    );
  }
  function select(
    name: string,
    label: string,
    options: Record<string, string>,
    required = false,
  ) {
    return (
      <label>
        {t(label)}
        {required ? " *" : ""}
        <select
          name={name}
          defaultValue={
            initial?.[name] === null ? "" : String(initial?.[name] ?? "")
          }
          required={required}
        >
          <option value="">{t('Seleccionar')}</option>
          {Object.entries(options).map(([v, l]) => (
            <option key={v} value={v}>
              {t(l)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || createdId) return;
    const addPhotos = !initial && (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-after-save') === 'photos';
    setError(null);
    setBusy(true);
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    const requestedRole = d.invite_role || 'viewer';
    delete d.invite_role;
    if (!initial && inviteAccess && !String(d.email || '').trim()) {
      setError(new Error(t('Escribe el correo de la persona para enviar la invitación.')));
      setBusy(false);
      return;
    }
    if (!schema || !catalog || schemaBusy || schemaError) { setBusy(false); return; }
    d.schema_version = schema.version;
    d.positions_version = catalog.version;
    d.custom_values = {};
    for (const key of Object.keys(d)) if (key.startsWith('custom_') && key !== 'custom_values') { d.custom_values[key.slice(7)] = d[key] || null; delete d[key]; }
    for (const k of Object.keys(d)) if (d[k] === "") d[k] = null;
    if (d.affiliated !== null) d.affiliated = d.affiliated === "1";
    if (initial) d.version = initial.version;
    try {
      const saved = await api<{id: string}>(
        "persons" + (initial ? "/" + initial.id : ""),
        initial ? "PATCH" : "POST",
        d,
      );
      if (!initial && inviteAccess && d.email) {
        const request = {person_id: saved.id, email: String(d.email), role: requestedRole};
        setCreatedId(saved.id);
        try {
          await api('invitations', 'POST', request);
          setInviteNotice('Invitación creada. La persona recibirá un correo para activar su cuenta.');
        } catch (inviteError) {
          setInviteFailure(request);
          setError(inviteError);
        }
      } else if (addPhotos) setCreatedId(saved.id);
      else onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (createdId) return <>
    <div className="page-heading"><div><span className="eyebrow">{principal.organization.name}</span><h1>{t('Fotografías del nuevo registro')}</h1>
      <p role="status">{t('El registro ya está guardado. Puedes añadir sus fotografías ahora o hacerlo después desde la lista.')}</p></div></div>
    <ErrorBox error={error} />
    {inviteNotice && <p className="notice" role="status">{t(inviteNotice)}</p>}
    {inviteFailure && <button type="button" disabled={busy} onClick={retryInvitation}>{t('Reintentar invitación')}</button>}
    <div className="panel"><PersonPhotos id={createdId} /></div>
    <div className="actions end"><button type="button" className="primary" onClick={onSaved}>{t('Terminar e ir a la lista')}</button></div>
  </>;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{principal.organization.name}</span>
          <h1>{t(initial ? 'Editar persona' : 'Nuevo registro')}</h1>
          <p className="muted">
            {t('Los campos con * son obligatorios para el estado elegido.')} {t(initial ? 'Puedes gestionar las fotografías desde el detalle de la persona.' : 'Puedes guardar y continuar con sus fotografías.')}
          </p>
        </div>
        <button onClick={onBack}>
          <ArrowLeft size={18} />
          {t('Volver')}
        </button>
      </div>
      <ErrorBox error={error} />
      <form key={formKey} onSubmit={save} className="person-form">
        <ErrorBox error={schemaError} />
        {schemaBusy && <Loading />}
        <button type="button" disabled={schemaBusy || busy} onClick={loadSchema}>{t('Recargar configuración de campos')}</button>
        <section className="panel">
          <div className="section-heading">
            <h2>{t('01 · Identificación')}</h2>
            <label className="inline">
              {t('Estado')}
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="pending">{t('Pendiente')}</option>
                <option value="complete">{t('Completado')}</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            {select("document_type", "Tipo de documento", documents, true)}
            {field("document_number", "Número de documento", "text", true, 30)}
            {field("first_names", "Nombres", "text", true)}
            {field("last_names", "Apellidos", "text", complete)}
            {select("gender", "Género", genders, complete)}
            {field("birth_date", "Fecha de nacimiento", "date", complete)}
          </div>
        </section>
        <section className="panel">
          <h2>{t('02 · Comunidad y ubicación')}</h2>
          <div className="form-grid">
            {select(
              "affiliated",
              "Afiliado",
              { "1": "Sí", "0": "No" },
              complete,
            )}
            <label>
              {t('Zona')}{complete ? ' *' : ''}
              <select
                name="zone"
                value={zone}
                required={complete}
                onChange={(e) => {
                  if (zone && zone !== e.target.value)
                    setChangeZone(e.target.value);
                  else setZone(e.target.value);
                }}
              >
                <option value="">{t('Seleccionar')}</option>
                <option value="rural">{t('Rural')}</option>
                <option value="urban">{t('Urbana')}</option>
              </select>
            </label>
            {zone === "rural" &&
              field(
                "property_name",
                "Nombre del predio",
                "text",
                complete,
                160,
              )}
            {zone === "urban" && (
              <>
                {field("address", "Dirección", "text", complete, 180)}
                {field("neighborhood", "Barrio", "text", complete, 100)}
              </>
            )}
            {catalog && select("position_code", "Cargo", Object.fromEntries(catalog.items.filter(i => i.active || i.code === initial?.position_code).map(i => [i.code, i.code === initial?.position_code
              ? `${localizedLabel({label: initial.position_label || i.label, label_en: initial.position_label_en})}${i.active ? '' : ` ${t('(inactivo)')}`}`
              : localizedLabel(i)])), complete)}
            {select(
              "descriptive_role",
              "Rol en la comunidad",
              Object.fromEntries(
                Object.entries(roleNames).filter(([v]) => v !== "superadmin"),
              ),
              complete,
            )}
            <label>
              {t('Junta de pertenencia')}
              <input value={principal.organization.name} readOnly />
            </label>
          </div>
          <p className="muted">
            {t('El cargo describe su función. El acceso real se concede mediante una invitación con un rol de cuenta, después de guardar la ficha.')}
          </p>
        </section>
        {!initial && <section className="panel">
          <h2>{t('Acceso al sistema')}</h2>
          <label className="inline">
            <input type="checkbox" checked={inviteAccess} onChange={e => setInviteAccess(e.target.checked)} />
            {t('Enviar invitación al correo de esta persona después de guardar')}
          </label>
          {inviteAccess && <div className="form-grid"><label>
            {t('Rol de acceso')}
            <select name="invite_role" defaultValue="viewer">
              {(principal.role === 'registrar' ? ['viewer'] : ['viewer', 'registrar', 'treasurer', 'auditor', 'admin']).map(role =>
                <option key={role} value={role}>{t(roleNames[role])}</option>)}
            </select>
          </label></div>}
          <p className="muted">{t('Se requiere un correo en la ficha. La persona confirma la invitación, acepta los términos y crea su propia contraseña. El registrador solo puede invitar con rol Consultor.')}</p>
        </section>}
        <section className="panel">
          <h2>{t('03 · Contacto')}</h2>
          <div className="form-grid">
            {field("phone", "Teléfono", "tel", complete, 20)}
            {field("email", "Correo electrónico", "email", complete, 254)}
          </div>
        </section>
        <section className="panel">
          <h2>{t('04 · Autorización de tratamiento')}</h2>
          <div className="form-grid">
            <label>
              {t('Fundamento o referencia del soporte')}{complete ? ' *' : ''}
              <input
                name="authorization_basis"
                required={complete}
                maxLength={120}
                placeholder={t('Ej.: consentimiento firmado el 10/10/2026')}
                defaultValue={initial?.authorization?.basis || ""}
              />
            </label>
            <label>
              {t('Finalidad de la captura')}{complete ? ' *' : ''}
              <input
                name="authorization_purpose"
                required={complete}
                maxLength={1000}
                placeholder={t('Ej.: gestionar el registro de la junta')}
                defaultValue={initial?.authorization?.purpose || ""}
              />
            </label>
          </div>
          <p className="muted">
            {t('Indica cómo autorizó la persona el uso de sus datos y para qué se usarán. En Pendiente puedes dejar ambos campos vacíos; para completar la ficha debes diligenciarlos.')} {t('La aceptación de términos del usuario no sustituye la autorización de la persona registrada.')}
          </p>
        </section>
        {schema && <AdditionalInputs schema={schema} previous={initial?.custom_fields} complete={complete} />}
        <section className="panel internal-note">
          <h2>{t('Nota interna')}</h2>
          <label>
            {t('Información reservada a administración y registro')}
            <textarea
              name="note"
              rows={4}
              maxLength={4000}
              defaultValue={initial?.note || ""}
            />
          </label>
        </section>
        <div className="form-actions">
          <button type="button" onClick={() => setClear(true)}>
            {t('Vaciar formulario')}
          </button>
          <button className="primary" disabled={busy || schemaBusy || !schema || !!schemaError}>
            <Save size={18} />
            {busy
              ? t('Guardando…')
              : initial
                ? t('Guardar cambios')
                : t('Guardar registro')}
          </button>
          {!initial && <button type="submit" data-after-save="photos" disabled={busy || schemaBusy || !schema || !!schemaError}>{t('Guardar y añadir fotos')}</button>}
        </div>
      </form>
      {clear && (
        <Modal title={t('Vaciar formulario')} onClose={() => setClear(false)}>
          <p>{t('Se descartarán los datos que has digitado en este formulario.')}</p>
          <div className="actions end">
            <button onClick={() => setClear(false)}>{t('Cancelar')}</button>
            <button
              className="primary"
              onClick={() => {
                document
                  .querySelector<HTMLFormElement>(".person-form")
                  ?.reset();
                setZone(initial?.zone || "");
                setStatus(initial?.status || "pending");
                setFormKey(formKey + 1);
                setClear(false);
              }}
            >
              {t('Confirmar')}
            </button>
          </div>
        </Modal>
      )}
      {changeZone !== null && (
        <Modal title={t('Cambiar zona')} onClose={() => setChangeZone(null)}>
          <p>
            {t('Los datos de ubicación que dejen de aplicar se retirarán al guardar.')}
          </p>
          <div className="actions end">
            <button onClick={() => setChangeZone(null)}>{t('Cancelar')}</button>
            <button
              className="primary"
              onClick={() => {
                setZone(changeZone);
                setChangeZone(null);
              }}
            >
              {t('Cambiar zona')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
