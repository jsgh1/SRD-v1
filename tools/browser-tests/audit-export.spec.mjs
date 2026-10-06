import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixture = JSON.parse(fs.readFileSync(process.env.SRD_BROWSER_FIXTURE));
const mailUrl = process.env.SRD_MAILPIT_URL || 'http://localhost:8025';

async function login(page, role) {
  await page.goto(`/j/${fixture.codeA}/login`);
  await page.getByLabel('Correo electrónico', { exact: true }).fill(fixture.users[role].email);
  await page.getByLabel('Contraseña', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'términos y condiciones', exact: true }).click();
  await page.getByRole('button', { name: 'Aceptar términos', exact: true }).click();
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingresa tu código' })).toBeVisible();
  let message;
  await expect.poll(async () => {
    const list = await (await page.request.get(`${mailUrl}/api/v1/messages`)).json();
    message = list.messages?.find(item => item.Subject === 'Tu código de seguridad de SRD' && item.To.some(to => to.Address === fixture.users[role].email));
    return !!message;
  }, { timeout: 85000 }).toBe(true);
  const content = await (await page.request.get(`${mailUrl}/api/v1/message/${message.ID}`)).json();
  await page.getByLabel('Código de verificación').fill(content.Text.match(/\b\d{6}\b/)[0]);
  await page.getByRole('button', { name: 'Confirmar código' }).click();
  await expect(page.locator('.sidebar').getByRole('button', { name: 'Home', exact: true })).toBeVisible();
}

test('audit Excel and PDF use applied filters and deny viewers', async ({ page, browser }) => {
  test.setTimeout(240000);
  await login(page, 'admin');
  await expect.poll(async () => {
    const body = await (await page.request.get(`/api/v1/audit-events?action=auth.login&actor_id=${fixture.users.admin.id}`)).json();
    return body.data?.total;
  }, { timeout: 85000, intervals: [1000,3000,5000] }).toBe(1);
  await page.locator('.sidebar').getByRole('button', { name: 'Auditoría', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Consulta de auditoría' });
  await panel.getByLabel('Actor (identificador)').fill(fixture.users.admin.id);
  await panel.getByRole('combobox', { name: 'Módulo', exact: true }).selectOption('identity');
  await panel.getByLabel('Acción', { exact: true }).fill('auth.login');
  await panel.getByRole('combobox', { name: 'Resultado', exact: true }).selectOption('success');
  await panel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(panel.getByRole('status')).toHaveText('1 eventos encontrados');
  // An unapplied draft must not change export selection.
  await panel.getByLabel('Acción', { exact: true }).fill('auth.logout');
  await panel.getByLabel('Nombre del archivo (opcional)').fill('Auditoría/Junta?.xlsx');
  for (const name of ['Exportar Excel','Exportar PDF']) await expect(panel.getByRole('button', {name})).toBeDisabled();
  await panel.getByLabel('Confirmo el nombre del archivo').check();
  const excelPromise = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Exportar Excel' }).click();
  const excel = await excelPromise;
  expect(excel.suggestedFilename()).toBe('Auditoria-Junta.xlsx');
  const bytes = fs.readFileSync(await excel.path());
  expect(bytes.includes(Buffer.from('auth.login'))).toBe(true);
  expect(bytes.includes(Buffer.from('auth.challenge_sent'))).toBe(false);
  const responsePromise = page.waitForResponse(r => r.url().includes('/api/v1/audit-events/export-pdf'));
  const pdfPromise = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Exportar PDF' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const data = (await response.json()).data;
  expect(data.count).toBe(1);
  expect(data.rows[0][2]).toBe('auth.login');
  const pdf = await pdfPromise;
  expect(pdf.suggestedFilename()).toBe('Auditoria-Junta.pdf');
  const pdfBytes = fs.readFileSync(await pdf.path());
  expect(pdfBytes.subarray(0,5).toString()).toBe('%PDF-');
  fs.writeFileSync('.local/audit-export-proof.pdf',pdfBytes);
  fs.writeFileSync('.local/audit-export-proof-event.txt',data.rows[0][6]);
  await page.setViewportSize({width:360,height:800});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await panel.getByRole('button',{name:'Exportar PDF'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'.local/audit-export-mobile.png'});
  const context = await browser.newContext({baseURL:process.env.SRD_TEST_URL || 'http://localhost:8080'});
  try {
    const viewer = await context.newPage();
    await login(viewer,'viewer');
    expect((await viewer.request.get('/api/v1/audit-events/export-pdf')).status()).toBe(403);
    await expect(viewer.locator('.sidebar').getByRole('button',{name:'Auditoría',exact:true})).toHaveCount(0);
  } finally { await context.close(); }
});
