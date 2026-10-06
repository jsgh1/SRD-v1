/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {AppState, NativeModules, Text, TextInput} from 'react-native';
import App from '../App';

jest.mock('react-native-safe-area-context', () => {
  const {View} = require('react-native');
  return {SafeAreaProvider: View, SafeAreaView: View};
});

test('muestra el inicio de sesión como primera pantalla', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(JSON.stringify(tree!.toJSON())).toContain('Iniciar sesión');
  await ReactTestRenderer.act(async () => tree!.unmount());
}, 20000);

const organization = {code: 'junta-prueba', name: 'Junta prueba', terms: {id: 't1', version: 1, body: 'Términos'}};
const principal = {user_id: 'u1', role: 'admin', user: {name: 'Ana', email: 'ana@example.test', theme: 'light', presence: 'online'}, organization, terms_required: false};
const response = (data: unknown, status = 200) => ({ok: status < 400, status, json: async () => ({data})}) as Response;
const organizationB = {code: 'junta-b', name: 'Junta B', terms: {id: 't-b', version: 2, body: 'Términos propios de B'}};

function button(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const found = tree.root.findAll(node => node.props.accessibilityRole === 'button'
    && node.findAllByType(Text).some(text => text.props.children === label))[0];
  if (!found) throw new Error(`No se encontró el botón ${label}`);
  return found;
}

afterEach(() => {
  delete NativeModules.SrdConnection;
  jest.restoreAllMocks();
});

test('recupera la sesión vigente sin guardar credenciales', async () => {
  NativeModules.SrdConnection = {load: jest.fn().mockResolvedValue({origin: 'https://srd.example.test', code: organization.code})};
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response(organization))
    .mockResolvedValueOnce(response(principal))
    .mockResolvedValueOnce(response({total: 0, today: 0, week: 0, month: 0}));
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {tree = ReactTestRenderer.create(<App />);});
  expect(JSON.stringify(tree!.toJSON())).toContain('"Hola, ","Ana"');
  expect(globalThis.fetch).toHaveBeenCalledWith('https://srd.example.test/api/v1/me', expect.objectContaining({credentials: 'include'}));
  await ReactTestRenderer.act(async () => tree!.unmount());
});

test('pide credenciales para la junta recordada si la sesión venció', async () => {
  NativeModules.SrdConnection = {load: jest.fn().mockResolvedValue({origin: 'https://srd.example.test', code: organization.code})};
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response(organization))
    .mockResolvedValueOnce({ok: false, status: 401, json: async () => ({error: {message: 'Sesión vencida'}})} as Response);
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {tree = ReactTestRenderer.create(<App />);});
  const content = JSON.stringify(tree!.toJSON());
  expect(content).toContain('Iniciar sesión');
  expect(content).toContain('Junta prueba');
  expect(content).not.toContain('Hola, Ana');
  await ReactTestRenderer.act(async () => tree!.unmount());
});

test('retira la vista autenticada si otra sesión revoca el acceso mientras está en segundo plano', async () => {
  NativeModules.SrdConnection = {load: jest.fn().mockResolvedValue({origin: 'https://srd.example.test', code: organization.code})};
  let onStateChange: Parameters<typeof AppState.addEventListener>[1] | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    onStateChange = listener;
    return {remove: jest.fn()};
  });
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response(organization))
    .mockResolvedValueOnce(response(principal))
    .mockResolvedValueOnce(response({total: 0, today: 0, week: 0, month: 0}))
    .mockResolvedValueOnce({ok: false, status: 401, json: async () => ({error: {message: 'Sesión revocada'}})} as Response);
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {tree = ReactTestRenderer.create(<App />);});
  expect(JSON.stringify(tree!.toJSON())).toContain('"Hola, ","Ana"');
  await ReactTestRenderer.act(async () => {onStateChange!('active');});
  const content = JSON.stringify(tree!.toJSON());
  expect(content).toContain('Iniciar sesión');
  expect(content).toContain('Tu sesión terminó');
  expect(content).not.toContain('"Hola, ","Ana"');
  await ReactTestRenderer.act(async () => tree!.unmount());
});

test('oculta los datos al volver sin red y los muestra tras comprobar de nuevo la sesión', async () => {
  NativeModules.SrdConnection = {load: jest.fn().mockResolvedValue({origin: 'https://srd.example.test', code: organization.code})};
  let onStateChange: Parameters<typeof AppState.addEventListener>[1] | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    onStateChange = listener;
    return {remove: jest.fn()};
  });
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response(organization))
    .mockResolvedValueOnce(response(principal))
    .mockResolvedValueOnce(response({total: 0, today: 0, week: 0, month: 0}))
    .mockRejectedValueOnce(new Error('Sin red'))
    .mockResolvedValueOnce(response(principal));
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {tree = ReactTestRenderer.create(<App />);});
  await ReactTestRenderer.act(async () => {onStateChange!('active');});
  const offline = JSON.stringify(tree!.toJSON());
  expect(offline).toContain('No se pudo comprobar la sesión');
  expect(offline).toContain('Reintentar');
  expect(offline).not.toContain('"Hola, ","Ana"');
  const retry = tree!.root.findAll(node => node.props.accessibilityRole === 'button'
    && node.findAllByType(Text).some(text => text.props.children === 'Reintentar'))[0];
  await ReactTestRenderer.act(async () => {retry.props.onPress();});
  expect(JSON.stringify(tree!.toJSON())).toContain('"Hola, ","Ana"');
  expect(globalThis.fetch).toHaveBeenCalledTimes(5);
  await ReactTestRenderer.act(async () => tree!.unmount());
});

test('cambia de junta solo tras aceptar términos y sustituye el resumen anterior', async () => {
  const saved = jest.fn().mockResolvedValue(undefined);
  NativeModules.SrdConnection = {load: jest.fn().mockResolvedValue({origin: 'https://srd.example.test', code: organization.code}), save: saved};
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response(organization))
    .mockResolvedValueOnce(response(principal))
    .mockResolvedValueOnce(response({total: 7, today: 0, week: 0, month: 0}))
    .mockResolvedValueOnce(response(organizationB))
    .mockResolvedValueOnce(response({token: 'csrf'}))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({...principal, role: 'viewer', organization: organizationB}))
    .mockResolvedValueOnce(response({total: 2, today: 0, week: 0, month: 0}));
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {tree = ReactTestRenderer.create(<App />);});
  await ReactTestRenderer.act(async () => {button(tree!, 'Cambiar de junta').props.onPress();});
  const input = tree!.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === 'Código de junta destino');
  await ReactTestRenderer.act(async () => {input!.props.onChangeText('junta-b');});
  await ReactTestRenderer.act(async () => {button(tree!, 'Cargar términos').props.onPress();});
  expect(JSON.stringify(tree!.toJSON())).toContain('Términos propios de B');
  expect(button(tree!, 'Aceptar y cambiar de junta').props.disabled).toBe(true);
  const checkbox = tree!.root.findAll(node => node.props.accessibilityRole === 'checkbox')[0];
  await ReactTestRenderer.act(async () => {checkbox.props.onPress();});
  await ReactTestRenderer.act(async () => {button(tree!, 'Aceptar y cambiar de junta').props.onPress();});
  const content = JSON.stringify(tree!.toJSON());
  expect(content).toContain('JUNTA B');
  expect(content).toContain('"2"');
  expect(content).not.toContain('"7"');
  expect(saved).toHaveBeenCalledWith('https://srd.example.test', 'junta-b');
  expect(globalThis.fetch).toHaveBeenCalledTimes(8);
  await ReactTestRenderer.act(async () => tree!.unmount());
});

test('consulta la junta activa tras perder la respuesta y evita repetir el cambio', async () => {
  const saved = jest.fn().mockResolvedValue(undefined);
  NativeModules.SrdConnection = {load: jest.fn().mockResolvedValue({origin: 'https://srd.example.test', code: organization.code}), save: saved};
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response(organization))
    .mockResolvedValueOnce(response(principal))
    .mockResolvedValueOnce(response({total: 7, today: 0, week: 0, month: 0}))
    .mockResolvedValueOnce(response(organizationB))
    .mockResolvedValueOnce(response({token: 'csrf'}))
    .mockRejectedValueOnce(new Error('Respuesta perdida'))
    .mockResolvedValueOnce(response({...principal, role: 'viewer', organization: organizationB}))
    .mockResolvedValueOnce(response({total: 2, today: 0, week: 0, month: 0}));
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {tree = ReactTestRenderer.create(<App />);});
  await ReactTestRenderer.act(async () => {button(tree!, 'Cambiar de junta').props.onPress();});
  const input = tree!.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === 'Código de junta destino');
  await ReactTestRenderer.act(async () => {input!.props.onChangeText('junta-b');});
  await ReactTestRenderer.act(async () => {button(tree!, 'Cargar términos').props.onPress();});
  const checkbox = tree!.root.findAll(node => node.props.accessibilityRole === 'checkbox')[0];
  await ReactTestRenderer.act(async () => {checkbox.props.onPress();});
  await ReactTestRenderer.act(async () => {button(tree!, 'Aceptar y cambiar de junta').props.onPress();});
  expect(JSON.stringify(tree!.toJSON())).toContain('Comprobar junta activa');
  expect(tree!.root.findAll(node => node.props.accessibilityRole === 'button'
    && node.findAllByType(Text).some(text => text.props.children === 'Aceptar y cambiar de junta'))).toHaveLength(0);
  expect(globalThis.fetch).toHaveBeenCalledTimes(6);
  await ReactTestRenderer.act(async () => {button(tree!, 'Comprobar junta activa').props.onPress();});
  expect(JSON.stringify(tree!.toJSON())).toContain('JUNTA B');
  expect(saved).toHaveBeenCalledWith('https://srd.example.test', 'junta-b');
  expect(globalThis.fetch).toHaveBeenCalledTimes(8);
  await ReactTestRenderer.act(async () => tree!.unmount());
});

test('exige aceptar los términos renovados de la junta activa antes del resumen', async () => {
  NativeModules.SrdConnection = {load: jest.fn().mockResolvedValue({origin: 'https://srd.example.test', code: organization.code}), save: jest.fn().mockResolvedValue(undefined)};
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce(response(organization))
    .mockResolvedValueOnce(response({...principal, terms_required: true}))
    .mockResolvedValueOnce(response({token: 'csrf'}))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response(principal))
    .mockResolvedValueOnce(response({total: 3, today: 0, week: 0, month: 0}));
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {tree = ReactTestRenderer.create(<App />);});
  expect(JSON.stringify(tree!.toJSON())).toContain('Términos actualizados');
  expect(button(tree!, 'Aceptar y continuar').props.disabled).toBe(true);
  const checkbox = tree!.root.findAll(node => node.props.accessibilityRole === 'checkbox')[0];
  await ReactTestRenderer.act(async () => {checkbox.props.onPress();});
  await ReactTestRenderer.act(async () => {button(tree!, 'Aceptar y continuar').props.onPress();});
  expect(JSON.stringify(tree!.toJSON())).toContain('Resumen de registros de tu junta');
  expect(globalThis.fetch).toHaveBeenCalledTimes(6);
  await ReactTestRenderer.act(async () => tree!.unmount());
});
