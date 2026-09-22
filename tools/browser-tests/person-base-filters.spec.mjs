import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const fixture = JSON.parse(fs.readFileSync(process.env.SRD_BROWSER_FIXTURE || path.join(root, '.local/e2e-fixture.json')));
async function login(page, role) {
  await page.goto(`/j/${fixture.codeA || 'srd-e2e-a'}/login`);
  await page.getByLabel('Correo electrónico', { exact: true }).fill(fixture.users[role].email);
  await page.getByLabel('Contraseña', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'términos y condiciones', exact: true }).click();
  await page.getByRole('button', { name: 'Aceptar términos', exact: true }).click();
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresa tu código' })).toBeVisible();
  let message;
  const url = process.env.SRD_MAILPIT_URL || 'http://127.0.0.1:8125';
  await expect.poll(async () => {
    const list = await (await page.request.get(`${url}/api/v1/messages`)).json();
    message = list.messages?.find(m => m.Subject === 'Tu código de seguridad de SRD' && m.To.some(t => t.Address === fixture.users[role].email));
    return !!message;
  }).toBe(true);
  const content = await (await page.request.get(`${url}/api/v1/message/${message.ID}`)).json();
  await page.getByLabel('Código de verificación').fill(content.Text.match(/\b\d{6}\b/)[0]);
  await page.getByRole('button', { name: 'Confirmar código' }).click();
  await expect(page.locator('.sidebar').getByRole('button', { name: 'Home', exact: true })).toBeVisible();
}
async function navigate(page, name) { await page.locator('.sidebar').getByRole('button', { name, exact: true }).click(); }
async function mutation(page, method, url, data) {
  const token = (await (await page.request.get('/api/v1/csrf')).json()).data.token;
  return page.request.fetch(url, { method, data, headers: { 'X-CSRF-TOKEN': token } });
}

test('base filters combine with custom fields, recover catalog and preserve historical cargos', async ({ page }) => {
  await login(page, 'admin');
  const ids=[];
  const field={id:crypto.randomUUID(),label:'Sector sintético',type:'text',active:true,required:false,options:[]};
  expect((await mutation(page,'PUT','/api/v1/person-fields',{version:0,fields:[field]})).status()).toBe(200);
  const catalog=(await (await page.request.get('/api/v1/person-positions')).json()).data;
  const code=crypto.randomUUID();
  catalog.items.push({code,label:'Vocal de prueba',active:true});
  expect((await mutation(page,'PUT','/api/v1/person-positions',{version:0,items:catalog.items})).status()).toBe(200);
  async function create(extra={}) {
    const result=await mutation(page,'POST','/api/v1/persons',{
      document_type:'CC',document_number:'BASE-'+ids.length,first_names:'Persona filtro base',status:'pending',
      affiliated:true,zone:'urban',gender:'female',descriptive_role:'viewer',position_code:code,
      positions_version:1,schema_version:1,custom_values:{[field.id]:'Norte'},
      authorization_basis:'Prueba sintética',authorization_purpose:'Verificar filtros combinados',...extra,
    });
    expect(result.status()).toBe(200); ids.push((await result.json()).data.id);
  }
  try {
    for(let i=0;i<11;i++) await create();
    await create({gender:'male'});
    await create({document_type:'TI'});
    await create({descriptive_role:'registrar'});
    await create({position_code:'fiscal'});
    await create({custom_values:{[field.id]:'Sur'}});
    catalog.items.find(item=>item.code===code).active=false;
    expect((await mutation(page,'PUT','/api/v1/person-positions',{version:1,items:catalog.items})).status()).toBe(200);
    await page.route('**/api/v1/person-positions',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Catálogo temporalmente no disponible'}})}));
    await navigate(page,'Lista');
    await expect(page.getByRole('button',{name:'Reintentar cargos'})).toBeVisible();
    await page.unroute('**/api/v1/person-positions');
    await page.getByRole('button',{name:'Reintentar cargos'}).click();
    const form=page.getByRole('form',{name:'Filtros de personas'});
    await expect(form.getByRole('combobox',{name:'Cargo',exact:true})).toBeEnabled();
    await form.getByRole('combobox',{name:'Cargo',exact:true}).selectOption({label:'Vocal de prueba (inactivo)'});
    await form.getByRole('combobox',{name:'Tipo de documento',exact:true}).selectOption('CC');
    await form.getByRole('combobox',{name:'Género',exact:true}).selectOption('female');
    await form.getByRole('combobox',{name:'Rol descriptivo',exact:true}).selectOption('viewer');
    await form.getByRole('combobox',{name:'Afiliación',exact:true}).selectOption('1');
    await page.getByRole('button',{name:'Agregar filtro adicional',exact:true}).click();
    await page.getByLabel('Valor del filtro 1').fill('Norte');
    await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
    await expect(page.getByText('11 registros encontrados',{exact:true})).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(10);
    await page.getByRole('button',{name:'Siguiente',exact:true}).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByText('Página 2',{exact:true})).toBeVisible();
    await form.getByRole('combobox',{name:'Género',exact:true}).selectOption('other');
    await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
    await expect(page.getByText('No encontramos registros',{exact:true})).toBeVisible();
    await expect(page.getByText('Página 1',{exact:true})).toBeVisible();
    await form.getByRole('combobox',{name:'Género',exact:true}).selectOption('female');
    await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
    await expect(page.getByText('11 registros encontrados',{exact:true})).toBeVisible();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:path.join(root,'.local/person-base-filters-desktop.png'),fullPage:true});
    await page.setViewportSize({width:360,height:800});
    await expect.poll(async()=>page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.screenshot({path:path.join(root,'.local/person-base-filters-mobile.png'),fullPage:true});
    await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();
    await expect(page.getByText('16 registros encontrados',{exact:true})).toBeVisible();
    for(const name of ['Cargo','Género','Tipo de documento','Rol descriptivo']) await expect(form.getByRole('combobox',{name,exact:true})).toHaveValue('');
    await expect(page.getByLabel('Valor del filtro 1')).toHaveCount(0);
  } finally {
    for(const id of ids) expect((await mutation(page,'DELETE','/api/v1/persons/'+id,{version:1,confirmed:true})).status()).toBe(200);
  }
});
