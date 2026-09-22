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
export function Status({ value }: { value: string }) {
  return (
    <span className={"status " + value}>
      {value === "complete" ? "Completado" : "Pendiente"}
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
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Documento</th>
            <th>Fecha de registro</th>
            <th>Estado</th>
            <th>Acciones</th>
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
                ).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}
              </td>
              <td>
                <Status value={p.status} />
              </td>
              <td>
                <div className="actions">
                  <button
                    className="icon-button"
                    title="Ver detalle"
                    aria-label={`Ver ${p.first_names}`}
                    onClick={() => onView(p)}
                  >
                    <Eye size={18} />
                  </button>
                  {onEdit && (
                    <button
                      className="icon-button"
                      aria-label={`Editar ${p.first_names}`}
                      onClick={() => onEdit(p)}
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="icon-button danger"
                      aria-label={`Eliminar ${p.first_names}`}
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
  );
}
export function PersonDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [person, setPerson] = useState<Person>(),
    [error, setError] = useState<unknown>();
  useEffect(() => {
    api("persons/" + id)
      .then(setPerson)
      .catch(setError);
  }, [id]);
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
    descriptive_role: "Rol descriptivo",
    property_name: "Predio",
    address: "Dirección",
    neighborhood: "Barrio",
  };
  function value(key: string, v: any) {
    if (v === null || v === undefined || v === "") return "Sin registrar";
    if (key === "affiliated") return v ? "Sí" : "No";
    if (key === "document_type") return documents[v];
    if (key === "gender") return genders[v];
    if (key === "position_code") return person?.position_label || positions[v] || v;
    if (key === "descriptive_role") return roleNames[v];
    if (key === "zone") return v === "rural" ? "Rural" : "Urbana";
    return String(v);
  }
  return (
    <Modal title="Detalle de persona" onClose={onClose}>
      <ErrorBox error={error} />
      {!person && !error ? (
        <Loading />
      ) : (
        person && (
          <>
            <div className="person-title">
              <span className="avatar">{person.first_names.slice(0, 1)}</span>
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
                  <dt>{label}</dt>
                  <dd>{value(key, person[key])}</dd>
                </div>
              ))}
            </dl>
            {"note" in person && (
              <section className="internal-note">
                <h3>Nota interna</h3>
                <p>{person.note || "Sin nota interna."}</p>
              </section>
            )}
            <AdditionalDetail values={person.custom_fields} />
            <PersonPhotos key={id} id={id} />
            <p className="muted">
              Versión {person.version} · El cargo y el rol descriptivo no
              conceden acceso al sistema.
            </p>
          </>
        )
      )}
    </Modal>
  );
}
type BaseFilters = { document_type: string; gender: string; descriptive_role: string; position_code: string };
const emptyBaseFilters: BaseFilters = { document_type: '', gender: '', descriptive_role: '', position_code: '' };

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
  const select = (key: keyof BaseFilters, label: string, options: Record<string, string>) => visible.includes(key) ? <label>{label}
    <select value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })}>
      <option value="">Todos</option>{Object.entries(options).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select></label> : null;
  if (!Object.keys(emptyBaseFilters).some(key=>visible.includes(key))) return null;
  return <fieldset className="person-extra-filters"><legend>Más filtros de la ficha</legend>
    <div className="person-extra-filter">
      {select('document_type', 'Tipo de documento', documents)}
      {select('gender', 'Género', genders)}
      {select('descriptive_role', 'Rol descriptivo', Object.fromEntries(Object.entries(roleNames).filter(([code]) => code !== 'superadmin')))}
      {visible.includes('position_code') && <label>Cargo<select value={value.position_code} disabled={!catalog} onChange={e => onChange({ ...value, position_code: e.target.value })}>
        <option value="">{catalog ? 'Todos' : 'Cargando cargos…'}</option>
        {catalog?.items.map(item => <option key={item.code} value={item.code}>{item.label}{item.active ? '' : ' (inactivo)'}</option>)}
      </select></label>}
    </div>
    <p className="muted">Todos los criterios deben coincidir. Cargo y rol describen la ficha, no los permisos de una cuenta. También puedes buscar cargos inactivos.</p>
    <ErrorBox error={error} />{!!error && <button type="button" onClick={() => setRevision(r => r + 1)}>Reintentar cargos</button>}
  </fieldset>;
}

export function Persons({
  principal,
  mode,
  onCreate,
}: {
  principal: Principal;
  mode: "list" | "lookup";
  onCreate: () => void;
}) {
  const [result, setResult] = useState<any>(),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [zone, setZone] = useState(""),
    [affiliated, setAffiliated] = useState(""),
    [baseFilters, setBaseFilters] = useState<BaseFilters>(emptyBaseFilters),
    [customFilters, setCustomFilters] = useState<ExtraFilter[]>([]),
    [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [applied, setApplied] = useState(""),
    [error, setError] = useState<unknown>(),
    [detail, setDetail] = useState<string>(),
    [edit, setEdit] = useState<Person>(),
    [remove, setRemove] = useState<Person>(),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const [filterSettings,setFilterSettings]=useState<FilterSettings>(), [filterError,setFilterError]=useState<unknown>(), [filterRevision,setFilterRevision]=useState(0);
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
  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPage(1);
    if (mode === "list") {
      const criteria={status,zone,affiliated,...baseFilters};
      const params = new URLSearchParams({ q: query });
      Object.entries(criteria).forEach(([key,value])=>{if(filterSettings?.base.includes(key))params.set(key,value);});
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
          <span className="eyebrow">REGISTRO COMUNITARIO</span>
          <h1>{mode === "list" ? "Lista de personas" : "Consultar persona"}</h1>
          <p className="muted">
            {mode === "list"
              ? "Encuentra y mantén al día los registros de tu junta."
              : "Busca una ficha por su tipo y número de documento."}
          </p>
        </div>
        {canWrite(principal.role) && (
          <button className="primary" onClick={onCreate}>
            <Plus size={18} />
            Nuevo registro
          </button>
        )}
      </div>
      <ErrorBox error={error} />
      <section className="panel">
        <form className="filters" onSubmit={search} aria-label="Filtros de personas">
          {mode === "list" ? (
            <>
              <label className="grow">
                Buscar
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nombre, apellido o documento"
                />
              </label>
              {filterSettings?.base.includes('status') && <label>
                Estado
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="pending">Pendiente</option>
                  <option value="complete">Completado</option>
                </select>
              </label>}
              {filterSettings?.base.includes('zone') && <label>
                Zona
                <select value={zone} onChange={(e) => setZone(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="rural">Rural</option>
                  <option value="urban">Urbana</option>
                </select>
              </label>}
              {filterSettings?.base.includes('affiliated') && <label>Afiliación<select value={affiliated} onChange={e => setAffiliated(e.target.value)}><option value="">Todas</option><option value="1">Afiliados</option><option value="0">No afiliados</option></select></label>}
              {filterSettings ? <><BasePersonFilters value={baseFilters} onChange={setBaseFilters} visible={filterSettings.base} />
              <PersonFilters value={customFilters} onChange={setCustomFilters} allowed={filterSettings.custom} /></> : filterError ? <div className="person-extra-filters"><ErrorBox error={filterError}/><button type="button" onClick={()=>setFilterRevision(v=>v+1)}>Reintentar configuración de filtros</button></div> : <Loading/>}
            </>
          ) : (
            <>
              <label>
                Tipo de documento
                <select name="document_type">
                  {Object.entries(documents).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grow">
                Número de documento
                <input name="document_number" required maxLength={30} />
              </label>
            </>
          )}
          <button className="primary" disabled={busy}>
            <Search size={18} />
            {mode === "list" ? "Aplicar filtros" : "Consultar"}
          </button>
          {mode === 'list' && <button type="button" onClick={() => { setQuery(''); setStatus(''); setZone(''); setAffiliated(''); setBaseFilters(emptyBaseFilters); setCustomFilters([]); setPage(1); setApplied(''); setRefresh(value => value + 1); }}>Limpiar filtros</button>}
        </form>
        {result ? (
          <>
            {result.items.length ? (
              <PersonTable
                rows={result.items}
                onView={(p) => setDetail(p.id)}
                onEdit={canWrite(principal.role) ? editPerson : undefined}
                onDelete={canAdmin(principal.role) ? setRemove : undefined}
              />
            ) : (
              <Empty title="No encontramos registros">
                Prueba con otros criterios o crea el primer registro de tu
                junta.
              </Empty>
            )}
            <div className="pagination">
              <span>{result.total} registros encontrados</span>
              {mode === "list" && (
                <>
                  <label>
                    Filas
                    <select
                      aria-label="Filas por página"
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
                    Anterior
                  </button>
                  <span>Página {page}</span>
                  <button
                    disabled={page * size >= result.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Siguiente
                  </button>
                </>
              )}
            </div>
          </>
        ) : mode === "list" ? (
          error ? null : <Loading />
        ) : (
          <Empty title="Consulta exacta">
            Completa los dos campos para buscar.
          </Empty>
        )}
      </section>
      {detail && (
        <PersonDetail id={detail} onClose={() => setDetail(undefined)} />
      )}
      {remove && (
        <Modal title="Eliminar registro" onClose={() => setRemove(undefined)}>
          <p>
            Se eliminará el registro de{" "}
            <strong>
              {remove.first_names} {remove.last_names}
            </strong>
            . Esta acción no puede deshacerse desde el sistema.
          </p>
          <div className="actions end">
            <button onClick={() => setRemove(undefined)}>Cancelar</button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={deletePerson}
            >
              Sí, eliminar
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
  async function loadSchema() {
    setSchemaBusy(true); setSchemaError(undefined);
    try { const [fields, cargos] = await Promise.all([api<FieldSchema>('person-fields'), api<PositionCatalog>('person-positions')]); setSchema(fields); setCatalog(cargos); } catch (e) { setSchemaError(e); }
    finally { setSchemaBusy(false); }
  }
  useEffect(() => { loadSchema(); }, []);
  function field(
    name: string,
    label: string,
    type = "text",
    required = false,
    max = 120,
  ) {
    return (
      <label>
        {label}
        {required ? " *" : ""}
        <input
          name={name}
          type={type}
          defaultValue={initial?.[name] ?? ""}
          required={required}
          maxLength={max}
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
        {label}
        {required ? " *" : ""}
        <select
          name={name}
          defaultValue={
            initial?.[name] === null ? "" : String(initial?.[name] ?? "")
          }
          required={required}
        >
          <option value="">Seleccionar</option>
          {Object.entries(options).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
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
      if (addPhotos) setCreatedId(saved.id);
      else onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (createdId) return <>
    <div className="page-heading"><div><span className="eyebrow">{principal.organization.name}</span><h1>Fotografías del nuevo registro</h1>
      <p role="status">El registro ya está guardado. Puedes añadir sus fotografías ahora o hacerlo después desde la lista.</p></div></div>
    <div className="panel"><PersonPhotos id={createdId} /></div>
    <div className="actions end"><button type="button" className="primary" onClick={onSaved}>Terminar e ir a la lista</button></div>
  </>;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{principal.organization.name}</span>
          <h1>{initial ? "Editar persona" : "Nuevo registro"}</h1>
          <p className="muted">
            Los campos con * son obligatorios para el estado elegido. {initial ? 'Puedes gestionar las fotografías desde el detalle de la persona.' : 'Puedes guardar y continuar con sus fotografías.'}
          </p>
        </div>
        <button onClick={onBack}>
          <ArrowLeft size={18} />
          Volver
        </button>
      </div>
      <ErrorBox error={error} />
      <form key={formKey} onSubmit={save} className="person-form">
        <ErrorBox error={schemaError} />
        {schemaBusy && <Loading />}
        <button type="button" disabled={schemaBusy || busy} onClick={loadSchema}>Recargar configuración de campos</button>
        <section className="panel">
          <div className="section-heading">
            <h2>01 · Identificación</h2>
            <label className="inline">
              Estado
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="pending">Pendiente</option>
                <option value="complete">Completado</option>
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
          <h2>02 · Comunidad y ubicación</h2>
          <div className="form-grid">
            {select(
              "affiliated",
              "Afiliado",
              { "1": "Sí", "0": "No" },
              complete,
            )}
            <label>
              Zona{complete ? " *" : ""}
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
                <option value="">Seleccionar</option>
                <option value="rural">Rural</option>
                <option value="urban">Urbana</option>
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
            {catalog && select("position_code", "Cargo", Object.fromEntries(catalog.items.filter(i => i.active || i.code === initial?.position_code).map(i => [i.code, i.code === initial?.position_code ? `${initial.position_label || i.label}${i.active ? '' : ' (inactivo)'}` : i.label])), complete)}
            {select(
              "descriptive_role",
              "Rol descriptivo",
              Object.fromEntries(
                Object.entries(roleNames).filter(([v]) => v !== "superadmin"),
              ),
              complete,
            )}
            <label>
              Junta de pertenencia
              <input value={principal.organization.name} readOnly />
            </label>
          </div>
          <p className="muted">
            El cargo y el rol de esta ficha son descriptivos; no crean una
            cuenta ni conceden permisos.
          </p>
        </section>
        <section className="panel">
          <h2>03 · Contacto</h2>
          <div className="form-grid">
            {field("phone", "Teléfono", "tel", complete, 20)}
            {field("email", "Correo electrónico", "email", complete, 254)}
          </div>
        </section>
        <section className="panel">
          <h2>04 · Autorización de tratamiento</h2>
          <div className="form-grid">
            <label>
              Fundamento o referencia del soporte *
              <input
                name="authorization_basis"
                required
                maxLength={120}
                defaultValue={initial?.authorization?.basis || ""}
              />
            </label>
            <label>
              Finalidad de la captura *
              <input
                name="authorization_purpose"
                required
                maxLength={1000}
                defaultValue={initial?.authorization?.purpose || ""}
              />
            </label>
          </div>
          <p className="muted">
            La aceptación de términos del usuario no sustituye la autorización
            de la persona registrada.
          </p>
        </section>
        {schema && <AdditionalInputs schema={schema} previous={initial?.custom_fields} complete={complete} />}
        <section className="panel internal-note">
          <h2>Nota interna</h2>
          <label>
            Información reservada a administración y registro
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
            Vaciar formulario
          </button>
          <button className="primary" disabled={busy || schemaBusy || !schema || !!schemaError}>
            <Save size={18} />
            {busy
              ? "Guardando…"
              : initial
                ? "Guardar cambios"
                : "Guardar registro"}
          </button>
          {!initial && <button type="submit" data-after-save="photos" disabled={busy || schemaBusy || !schema || !!schemaError}>Guardar y añadir fotos</button>}
        </div>
      </form>
      {clear && (
        <Modal title="Vaciar formulario" onClose={() => setClear(false)}>
          <p>Se descartarán los datos que has digitado en este formulario.</p>
          <div className="actions end">
            <button onClick={() => setClear(false)}>Cancelar</button>
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
              Confirmar
            </button>
          </div>
        </Modal>
      )}
      {changeZone !== null && (
        <Modal title="Cambiar zona" onClose={() => setChangeZone(null)}>
          <p>
            Los datos de ubicación que dejen de aplicar se retirarán al guardar.
          </p>
          <div className="actions end">
            <button onClick={() => setChangeZone(null)}>Cancelar</button>
            <button
              className="primary"
              onClick={() => {
                setZone(changeZone);
                setChangeZone(null);
              }}
            >
              Cambiar zona
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
