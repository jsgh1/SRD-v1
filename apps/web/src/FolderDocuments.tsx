import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import { Empty, ErrorBox, Loading, Modal } from './ui';
type Doc = { id: string; folder_id: string | null; name: string; mime: string; bytes: number; sha256: string; version: number };
type Listing = { items: Doc[]; total: number; page_size: number };
type Quota = { used_bytes: number; limit_bytes: number; available_bytes: number };
const docxMime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const xlsxMime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const kind=(item:Doc)=>item.mime==='image/png'?'imagen':['audio/wav','audio/mpeg'].includes(item.mime)?'audio':'documento';
const space=(bytes:number)=>bytes>=1024*1024*1024?`${(bytes/(1024*1024*1024)).toLocaleString('es-CO',{maximumFractionDigits:2})} GiB`:
  bytes>=1024*1024?`${(bytes/(1024*1024)).toLocaleString('es-CO',{maximumFractionDigits:2})} MiB`:
  `${(bytes/1024).toLocaleString('es-CO',{maximumFractionDigits:1})} KiB`;
export function FolderDocuments({ folder,readOnly=false }: { folder?: string; readOnly?: boolean }) {
  const [page,setPage]=useState(1), [revision,setRevision]=useState(0), [listing,setListing]=useState<Listing>();
  const [loading,setLoading]=useState(true), [error,setError]=useState<unknown>();
  const [file,setFile]=useState<File>(), [name,setName]=useState(''), [uploading,setUploading]=useState(false);
  const [downloading,setDownloading]=useState<string>(), [status,setStatus]=useState('');
  const [renaming,setRenaming]=useState<Doc>();
  const [moving,setMoving]=useState<Doc>();
  const [removing,setRemoving]=useState<Doc>();
  const [previewing,setPreviewing]=useState<Doc>();
  const [previewingAudio,setPreviewingAudio]=useState<Doc>();
  const [previewingOffice,setPreviewingOffice]=useState<Doc>();
  const [previewingPdf,setPreviewingPdf]=useState<Doc>();
  const input=useRef<HTMLInputElement>(null), uploadId=useRef<string | undefined>(undefined);
  const active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{
    let current=true;setLoading(true);setListing(undefined);setError(undefined);
    const query=new URLSearchParams({page:String(page)});if(folder)query.set('folder_id',folder);
    api<Listing>(`folder-documents?${query}`).then(data=>{
      if(!current)return;const last=Math.max(1,Math.ceil(data.total/data.page_size));
      if(page>last)setPage(last);else setListing(data);
    }).catch(err=>{if(current)setError(err);}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[folder,page,revision]);
  async function upload(event:FormEvent){
    event.preventDefault();if(!file||uploading)return;setError(undefined);setStatus('');
    const image=/\.(png|jpe?g|webp)$/i.test(name);
    if(!/\.(docx|xlsx|pdf|wav|mp3|png|jpe?g|webp)$/i.test(name)||file.size>(image?5:20)*1024*1024){setError(new Error('Elige un DOCX/XLSX/PDF/WAV/MP3 de hasta 20 MB o una imagen PNG/JPEG/WebP de hasta 5 MB.'));return;}
    setUploading(true);
    try{
      const content=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();reader.onerror=()=>reject(new Error('No se pudo leer el archivo.'));
        reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);
      });
      if(!active.current)return;uploadId.current??=crypto.randomUUID();
      await api('folder-documents','POST',{id:uploadId.current,folder_id:folder??null,name,content});
      if(!active.current)return;setStatus(image?'Imagen guardada y analizada como PNG.':/\.(wav|mp3)$/i.test(name)?'Audio guardado y analizado.':'Documento guardado y analizado.');setFile(undefined);setName('');uploadId.current=undefined;
      if(input.current)input.current.value='';setRevision(value=>value+1);
    }catch(err){if(active.current)setError(err);}finally{if(active.current)setUploading(false);}
  }
  async function download(item:Doc){
    if(downloading)return;setDownloading(item.id);setError(undefined);
    try{
      const result=await api<Doc&{content:string}>(`folder-documents/${item.id}/download`);if(!active.current)return;
      const bytes=Uint8Array.from(atob(result.content),char=>char.charCodeAt(0));
      const url=URL.createObjectURL(new Blob([bytes],{type:result.mime}));
      const link=document.createElement('a');link.href=url;link.download=result.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(err){if(active.current)setError(err);}finally{if(active.current)setDownloading(undefined);}
  }
  return <section className="panel" aria-label="Archivos privados"><h2>Archivos privados</h2>
    <p>DOCX/XLSX/PDF, WAV PCM de 16 bits y MP3 MPEG-1 de hasta 20 MB, o imágenes PNG/JPEG/WebP de hasta 5 MB. Las imágenes se convierten a PNG y las etiquetas MP3 se retiran. Todo archivo se analiza antes de aparecer en la lista. Puedes ver extractos de DOCX/XLSX, navegar páginas de un PDF y escuchar audio autorizado.</p>
    {!readOnly&&<form onSubmit={upload} className="form-grid"><label>Documento, imagen o audio<input ref={input} type="file" accept=".docx,.xlsx,.pdf,.wav,.mp3,.png,.jpg,.jpeg,.webp" disabled={uploading} onChange={event=>{
      const selected=event.target.files?.[0];setFile(selected);setName(selected?.name??'');uploadId.current=undefined;setStatus('');
    }}/></label><label>Nombre del archivo<input required maxLength={255} value={name} disabled={uploading} onChange={event=>{setName(event.target.value);uploadId.current=undefined;}}/></label>
      <button className="primary" disabled={uploading||!file}>{uploading?'Analizando archivo…':'Guardar archivo'}</button></form>}
    {!readOnly&&<FolderQuota revision={revision}/>}
    <p role="status">{status}</p><ErrorBox error={error}/><button disabled={loading||uploading} onClick={()=>setRevision(value=>value+1)}>Actualizar archivos</button>
    {loading&&<Loading/>}{listing&&<><p>{listing.total} {listing.total===1?'archivo':'archivos'} en esta ubicación.</p>
      {listing.items.length?<div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Tamaño</th><th>Acción</th></tr></thead><tbody>
        {listing.items.map(item=><tr key={item.id}><td>{item.name}</td><td>{Math.ceil(item.bytes/1024)} KB</td><td>
          <div className="actions">{item.mime==='image/png'&&<button disabled={uploading||!!downloading} onClick={()=>setPreviewing(item)} aria-label={`Ver imagen ${item.name}`}>Ver imagen</button>}
          {['audio/wav','audio/mpeg'].includes(item.mime)&&<button disabled={uploading||!!downloading} onClick={()=>setPreviewingAudio(item)} aria-label={`Escuchar ${item.name}`}>Escuchar</button>}
          {item.mime===docxMime&&<button disabled={uploading||!!downloading} onClick={()=>setPreviewingOffice(item)} aria-label={`Ver texto de ${item.name}`}>Ver texto</button>}
          {item.mime===xlsxMime&&<button disabled={uploading||!!downloading} onClick={()=>setPreviewingOffice(item)} aria-label={`Ver hoja de ${item.name}`}>Ver hoja</button>}
          {item.mime==='application/pdf'&&<button disabled={uploading||!!downloading} onClick={()=>setPreviewingPdf(item)} aria-label={`Ver PDF ${item.name}`}>Ver PDF</button>}
          <button disabled={!!downloading} onClick={()=>void download(item)} aria-label={`Descargar ${item.name}`}>{downloading===item.id?'Descargando…':'Descargar'}</button>
          {!readOnly&&<><button disabled={uploading||!!downloading} onClick={()=>{setStatus('');setRenaming(item);}} aria-label={`Renombrar ${kind(item)} ${item.name}`}>Renombrar</button>
          <button disabled={uploading||!!downloading} onClick={()=>{setStatus('');setMoving(item);}} aria-label={`Mover ${kind(item)} ${item.name}`}>Mover</button>
          <button disabled={uploading||!!downloading} onClick={()=>{setStatus('');setRemoving(item);}} aria-label={`Eliminar ${kind(item)} ${item.name}`}>Eliminar</button></>}</div></td></tr>)}
      </tbody></table></div>:<Empty title="No hay archivos en esta ubicación">Los archivos aprobados aparecerán aquí.</Empty>}
      <div className="actions"><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>Archivos anteriores</button><span>Página {page}</span>
        <button disabled={page*listing.page_size>=listing.total} onClick={()=>setPage(value=>value+1)}>Archivos siguientes</button></div></>}
    {renaming&&<RenameDocument item={renaming} onClose={()=>setRenaming(undefined)} onRefresh={()=>{setRenaming(undefined);setRevision(value=>value+1);}}
      onSaved={()=>{if(active.current){setRenaming(undefined);setStatus(renaming.mime==='image/png'?'Nombre de la imagen actualizado.':'Nombre del documento actualizado.');setRevision(value=>value+1);}}}/>}
    {moving&&<MoveDocument item={moving} onClose={()=>setMoving(undefined)} onRefresh={()=>{setMoving(undefined);setRevision(value=>value+1);}}
      onMoved={()=>{if(active.current){setMoving(undefined);setStatus(moving.mime==='image/png'?'Imagen movida.':'Documento movido.');setRevision(value=>value+1);}}}/>}
    {removing&&<DeleteDocument item={removing} onClose={()=>setRemoving(undefined)} onRefresh={()=>{setRemoving(undefined);setRevision(value=>value+1);}}
      onDeleted={()=>{if(active.current){setRemoving(undefined);setStatus(removing.mime==='image/png'?'Imagen eliminada.':'Documento eliminado.');setRevision(value=>value+1);}}}/>}
    {previewing&&<PreviewImage item={previewing} onClose={()=>setPreviewing(undefined)} onRefresh={()=>{setPreviewing(undefined);setRevision(value=>value+1);}}/>}
    {previewingAudio&&<PreviewAudio item={previewingAudio} onClose={()=>setPreviewingAudio(undefined)} onRefresh={()=>{setPreviewingAudio(undefined);setRevision(value=>value+1);}}/>}
    {previewingOffice&&<PreviewOffice item={previewingOffice} onClose={()=>setPreviewingOffice(undefined)} onRefresh={()=>{setPreviewingOffice(undefined);setRevision(value=>value+1);}}/>}
    {previewingPdf&&<PreviewPdf item={previewingPdf} onClose={()=>setPreviewingPdf(undefined)} onRefresh={()=>{setPreviewingPdf(undefined);setRevision(value=>value+1);}}/>}
  </section>;
}

function FolderQuota({revision}:{revision:number}){
  const [quota,setQuota]=useState<Quota>(),[error,setError]=useState<unknown>();
  useEffect(()=>{
    let current=true;setError(undefined);
    api<Quota>('folder-quota').then(value=>{if(current){setQuota(value);setError(undefined);}})
      .catch(reason=>{if(current){setQuota(undefined);setError(reason);}});
    return()=>{current=false;};
  },[revision]);
  return <div aria-label="Espacio compartido de la junta">
    {quota&&<><p>Espacio compartido: {space(quota.used_bytes)} de {space(quota.limit_bytes)} usados · {space(quota.available_bytes)} disponibles.</p>
      <progress aria-label="Espacio utilizado" value={quota.used_bytes} max={quota.limit_bytes}/></>}
    <p className="muted">Incluye fotos, archivos y retiros pendientes. El espacio de un archivo eliminado se libera cuando termina su limpieza.</p>
    <ErrorBox error={error}/>
  </div>;
}

function PreviewAudio({item,onClose,onRefresh}:{item:Doc;onClose:()=>void;onRefresh:()=>void}){
  const [src,setSrc]=useState<string>(),[error,setError]=useState<unknown>();
  useEffect(()=>{
    let current=true,objectUrl:string|undefined;
    api<Doc&{content:string}>(`folder-documents/${item.id}/download`).then(result=>{
      if(!current)return;
      if(result.id!==item.id||result.version!==item.version||result.name!==item.name||result.mime!==item.mime||!['audio/wav','audio/mpeg'].includes(result.mime)
        ||result.bytes!==item.bytes||result.sha256!==item.sha256)
        throw new Error('El audio cambió. Actualiza los archivos antes de escucharlo.');
      const bytes=Uint8Array.from(atob(result.content),char=>char.charCodeAt(0));
      objectUrl=URL.createObjectURL(new Blob([bytes],{type:result.mime}));setSrc(objectUrl);
    }).catch(reason=>{if(current)setError(reason);});
    return()=>{current=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[item.id,item.version,item.name,item.bytes,item.sha256]);
  return <Modal title={`Escuchar: ${item.name}`} onClose={onClose}>
    <p className="muted">Audio privado. La reproducción comienza solo cuando pulses el control.</p>
    {src?<audio controls preload="metadata" src={src} className="folder-audio-player" aria-label={`Reproducir ${item.name}`}/>:!error&&<Loading/>}
    <ErrorBox error={error}/>
    <div className="actions">{!!error&&<button onClick={onRefresh}>Actualizar archivos y cerrar</button>}<button onClick={onClose}>Cerrar audio</button></div>
  </Modal>;
}

function PreviewImage({item,onClose,onRefresh}:{item:Doc;onClose:()=>void;onRefresh:()=>void}){
  const [src,setSrc]=useState<string>(),[error,setError]=useState<unknown>();
  useEffect(()=>{
    let current=true;
    api<Doc&{content:string}>(`folder-documents/${item.id}/download`).then(result=>{
      if(!current)return;
      if(result.id!==item.id||result.version!==item.version||result.mime!=='image/png'||result.bytes!==item.bytes||result.sha256!==item.sha256)
        throw new Error('La imagen cambió. Actualiza los archivos antes de verla.');
      setSrc(`data:image/png;base64,${result.content}`);
    }).catch(reason=>{if(current)setError(reason);});
    return()=>{current=false;};
  },[item.id,item.version,item.mime,item.bytes,item.sha256]);
  return <Modal title={`Vista previa: ${item.name}`} onClose={onClose}>
    {src?<img className="folder-image-full" src={src} alt={item.name}/>:!error&&<Loading/>}
    <ErrorBox error={error}/>
    <div className="actions">{!!error&&<button onClick={onRefresh}>Actualizar archivos y cerrar</button>}<button onClick={onClose}>Cerrar vista previa</button></div>
  </Modal>;
}

function PreviewPdf({item,onClose,onRefresh}:{item:Doc;onClose:()=>void;onRefresh:()=>void}){
  const [src,setSrc]=useState<string>(),[error,setError]=useState<unknown>(),[page,setPage]=useState(1),[pages,setPages]=useState<number>();
  useEffect(()=>{
    let current=true;setSrc(undefined);setError(undefined);
    api<Doc&{preview:{format:string;mime:string;width:number;height:number;page:number;pages:number;content:string}}>(`folder-documents/${item.id}/preview?page=${page}`).then(result=>{
      if(!current)return;
      if(result.id!==item.id||result.version!==item.version||result.name!==item.name||result.mime!==item.mime
        ||result.bytes!==item.bytes||result.sha256!==item.sha256||result.preview.format!=='image'
        ||result.preview.mime!=='image/png'||result.preview.page!==page||result.preview.pages<page||result.preview.pages>1000
        ||result.preview.width<1||result.preview.height<1
        ||result.preview.width>1200||result.preview.height>1200)
        throw new Error('El PDF cambió. Actualiza los archivos antes de verlo.');
      setPages(result.preview.pages);setSrc(`data:image/png;base64,${result.preview.content}`);
    }).catch(reason=>{if(current)setError(reason);});
    return()=>{current=false;};
  },[item.id,item.version,item.name,item.mime,item.bytes,item.sha256,page]);
  return <Modal title={`Vista previa PDF: ${item.name}`} onClose={onClose}>
    <p className="muted">Cada página se genera como imagen al solicitarla. Descarga el PDF para abrir el archivo original en tu lector.</p>
    {src?<img className="folder-image-full" src={src} alt={`Página ${page} de ${item.name}`}/>:!error&&<Loading/>}
    <ErrorBox error={error}/>
    {pages&&<div className="actions"><button disabled={page<=1||(!src&&!error)} onClick={()=>{setError(undefined);setSrc(undefined);setPage(value=>value-1);}}>Página anterior</button>
      <span>Página {page} de {pages}</span><button disabled={page>=pages||!src} onClick={()=>{setSrc(undefined);setPage(value=>value+1);}}>Página siguiente</button></div>}
    <div className="actions">{!!error&&<button onClick={onRefresh}>Actualizar archivos y cerrar</button>}<button onClick={onClose}>Cerrar vista previa</button></div>
  </Modal>;
}

type OfficeExcerpt={format:'plain_text';text:string;truncated:boolean}|{format:'grid';sheet:string|null;sheet_index:number|null;sheets:{index:number;name:string}[];sheets_truncated:boolean;columns:number;rows:{number:number;cells:string[]}[];truncated:boolean};
function PreviewOffice({item,onClose,onRefresh}:{item:Doc;onClose:()=>void;onRefresh:()=>void}){
  const [excerpt,setExcerpt]=useState<OfficeExcerpt>(),[error,setError]=useState<unknown>(),[sheetIndex,setSheetIndex]=useState(1);
  const [availableSheets,setAvailableSheets]=useState<{index:number;name:string}[]>([]);
  useEffect(()=>{
    let current=true;
    api<Doc&{preview:OfficeExcerpt}>(`folder-documents/${item.id}/preview${item.mime===xlsxMime?`?sheet=${sheetIndex}`:''}`).then(result=>{
      if(!current)return;
      if(result.id!==item.id||result.version!==item.version||result.mime!==item.mime||result.bytes!==item.bytes||result.sha256!==item.sha256
        ||result.preview.format!==(item.mime===docxMime?'plain_text':'grid')
        ||(result.preview.format==='grid'&&result.preview.sheet_index!==sheetIndex&&result.preview.sheet_index!==null))
        throw new Error('El documento cambió. Actualiza los archivos antes de verlo.');
      if(result.preview.format==='grid')setAvailableSheets(result.preview.sheets);
      setExcerpt(result.preview);
    }).catch(reason=>{if(current)setError(reason);});
    return()=>{current=false;};
  },[item.id,item.version,item.mime,item.bytes,item.sha256,sheetIndex]);
  return <Modal title={`${item.mime===docxMime?'Texto':'Hoja'} de ${item.name}`} onClose={onClose}>
    {excerpt?.format==='plain_text'&&<><p className="muted">Extracto de texto del DOCX. No reproduce imágenes, tablas ni el diseño original; descarga el archivo para verlo completo.</p>
      <pre className="folder-office-text">{excerpt.text||'No se encontró texto en el documento.'}</pre>
      {excerpt.truncated&&<p className="muted">El extracto se limitó a 200 párrafos o 20.000 caracteres.</p>}</>}
    {item.mime===xlsxMime&&availableSheets.length>1&&<label>Elegir hoja <select aria-label="Elegir hoja" value={sheetIndex} onChange={event=>{setSheetIndex(Number(event.target.value));setExcerpt(undefined);setError(undefined);}}>{availableSheets.map(sheet=><option key={sheet.index} value={sheet.index}>{sheet.name}</option>)}</select></label>}
    {excerpt?.format==='grid'&&<><p className="muted">Hoja: {excerpt.sheet||'sin hojas'}. Se muestran valores sin formato, hasta 50 filas, 12 columnas y 20.000 caracteres por hoja. Descarga el archivo para ver su formato completo.</p>
      {excerpt.sheets_truncated&&<p className="muted">La vista permite elegir entre las primeras 32 hojas. Descarga el archivo para acceder a las demás.</p>}
      {excerpt.rows.length?<div className="table-wrap folder-preview-grid"><table aria-label="Extracto de hoja de cálculo"><thead><tr><th scope="col">Fila</th>
        {Array.from({length:excerpt.columns},(_,index)=><th scope="col" key={index}>{String.fromCharCode(65+index)}</th>)}</tr></thead><tbody>
        {excerpt.rows.map((row,index)=><tr key={`${row.number}-${index}`}><th scope="row">{row.number}</th>{row.cells.map((cell,column)=><td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>
        :<Empty title="Esta hoja está vacía">No hay celdas para mostrar en este extracto.</Empty>}
      {excerpt.truncated&&<p className="muted">El extracto se limitó a las primeras filas, columnas o caracteres.</p>}</>}
    {!excerpt&&!error&&<Loading/>}
    <ErrorBox error={error}/>
    <div className="actions">{!!error&&<button onClick={onRefresh}>Actualizar archivos y cerrar</button>}<button onClick={onClose}>Cerrar vista previa</button></div>
  </Modal>;
}

function DeleteDocument({item,onClose,onDeleted,onRefresh}:{item:Doc;onClose:()=>void;onDeleted:()=>void;onRefresh:()=>void}){
  const [confirmed,setConfirmed]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState<unknown>();
  const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function remove(event:FormEvent){
    event.preventDefault();if(!confirmed||saving)return;setSaving(true);setError(undefined);
    try{await api(`folder-documents/${item.id}`,'DELETE',{version:item.version,confirm:true});if(active.current)onDeleted();}
    catch(err){if(active.current)setError(err);}finally{if(active.current)setSaving(false);}
  }
  return <Modal title={`Eliminar ${kind(item)}: ${item.name}`} onClose={()=>{if(!saving)onClose();}}>
    <form onSubmit={remove}><p>El archivo dejará de estar disponible. Esta acción no se puede deshacer.</p>
      <label className="check-label"><input type="checkbox" checked={confirmed} disabled={saving} onChange={event=>setConfirmed(event.target.checked)}/> Confirmo que quiero eliminar este archivo.</label>
      <ErrorBox error={error}/><div className="actions"><button type="button" disabled={saving} onClick={onClose}>Cancelar eliminación</button>
        {error instanceof ApiError&&[404,409].includes(error.status)&&<button type="button" disabled={saving} onClick={onRefresh}>Actualizar archivos y cerrar</button>}
        <button disabled={!confirmed||saving}>{saving?'Eliminando archivo…':'Sí, eliminar archivo'}</button></div>
    </form>
  </Modal>;
}

type Destination = {items:{id:string;name:string}[];breadcrumbs:{id:string;name:string}[];total:number;page_size:number};
function MoveDocument({item,onClose,onMoved,onRefresh}:{item:Doc;onClose:()=>void;onMoved:()=>void;onRefresh:()=>void}){
  const [parent,setParent]=useState<string|undefined>(item.folder_id??undefined),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
  const [listing,setListing]=useState<Destination>(),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState<unknown>();
  const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{
    let current=true;setLoading(true);setListing(undefined);setError(undefined);
    const query=new URLSearchParams({page:String(page)});if(parent)query.set('parent_id',parent);
    api<Destination>(`folders?${query}`).then(data=>{
      if(!current)return;const last=Math.max(1,Math.ceil(data.total/data.page_size));
      if(page>last)setPage(last);else setListing(data);
    }).catch(err=>{if(current)setError(err);}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[parent,page,revision]);
  function navigate(id?:string){setParent(id);setPage(1);}
  async function move(){
    if(saving||loading||!listing||(parent??null)===item.folder_id)return;setSaving(true);setError(undefined);
    try{await api(`folder-documents/${item.id}/move`,'POST',{folder_id:parent??null,version:item.version});if(active.current)onMoved();}
    catch(err){if(active.current)setError(err);}finally{if(active.current)setSaving(false);}
  }
  return <Modal title={`Mover ${kind(item)}: ${item.name}`} onClose={()=>{if(!saving)onClose();}}>
    <p>Elige la ubicación de destino. El archivo conservará su contenido y nombre.</p>
    <nav className="actions" aria-label="Ruta de destino del documento"><button disabled={saving||loading} onClick={()=>navigate()}>Inicio del destino</button>
      {listing?.breadcrumbs.map(row=><button key={row.id} disabled={saving||loading} onClick={()=>navigate(row.id)}>{row.name}</button>)}</nav>
    <ErrorBox error={error}/>{loading&&<Loading/>}
    {listing&&<><p>Destino: {listing.breadcrumbs.map(row=>row.name).join(' / ')||'Inicio'}</p>
      <div className="actions">{listing.items.map(row=><button key={row.id} disabled={saving} onClick={()=>navigate(row.id)} aria-label={`Abrir destino ${row.name}`}>{row.name}</button>)}</div>
      <div className="actions"><button disabled={saving||page===1} onClick={()=>setPage(value=>value-1)}>Página anterior de destinos</button><span>Página {page}</span>
        <button disabled={saving||page*listing.page_size>=listing.total} onClick={()=>setPage(value=>value+1)}>Página siguiente de destinos</button></div></>}
    <div className="actions"><button disabled={saving||loading} onClick={()=>setRevision(value=>value+1)}>Actualizar destinos</button>
      <button disabled={saving} onClick={onClose}>Cancelar movimiento</button>
      {error instanceof ApiError&&error.status===409&&<button disabled={saving} onClick={onRefresh}>Actualizar archivos y cerrar</button>}
      <button className="primary" disabled={saving||loading||!listing||(parent??null)===item.folder_id} onClick={()=>void move()}>{saving?'Moviendo documento…':'Mover a esta ubicación'}</button></div>
  </Modal>;
}

function RenameDocument({item,onClose,onSaved,onRefresh}:{item:Doc;onClose:()=>void;onSaved:()=>void;onRefresh:()=>void}){
  const [name,setName]=useState(item.name),[saving,setSaving]=useState(false),[error,setError]=useState<unknown>();
  const active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function save(event:FormEvent){
    event.preventDefault();if(saving)return;setSaving(true);setError(undefined);
    try{await api(`folder-documents/${item.id}`,'PATCH',{name,version:item.version});if(active.current)onSaved();}
    catch(err){if(active.current)setError(err);}finally{if(active.current)setSaving(false);}
  }
  return <Modal title={`Renombrar ${kind(item)}: ${item.name}`} onClose={()=>{if(!saving)onClose();}}>
    <form onSubmit={save} className="form-grid"><p>Conserva la extensión .{item.name.split('.').pop()?.toLowerCase()}. El contenido del archivo se conserva.</p>
      <label>Nuevo nombre del archivo<input autoFocus required maxLength={255} value={name} disabled={saving} onChange={event=>setName(event.target.value)}/></label>
      <ErrorBox error={error}/><div className="actions"><button type="button" disabled={saving} onClick={onClose}>Cancelar cambio de nombre</button>
        {error instanceof ApiError&&error.status===409&&<button type="button" disabled={saving} onClick={onRefresh}>Actualizar archivos y cerrar</button>}
        <button className="primary" disabled={saving}>{saving?'Guardando nombre…':'Guardar nuevo nombre'}</button></div>
    </form>
  </Modal>;
}
