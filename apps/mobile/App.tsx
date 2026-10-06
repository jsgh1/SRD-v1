import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, AppState, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {ApiError, Dashboard, DocumentType, GatewayClient, normalizeOrigin, NotificationPreferences, Organization, PendingPersonInput, Person, PersonPage, Principal, UnconfirmedWriteError} from './src/api';
import {AgendaScreen, EventScreen, InvitationScreen} from './src/Agenda';
import {addCalendarDays, agendaWindow, bogotaToday, type CalendarEvent, type CalendarInvitation, type InvitationPage} from './src/calendar';
import {NotificationsScreen} from './src/Notifications';
import {NotificationPreferencesScreen} from './src/NotificationPreferences';
import {type Notice, type NotificationInbox} from './src/notificationModels';
import {ProfileScreen} from './src/Profile';
import {SwitchOrganizationScreen} from './src/SwitchOrganization';
import {connectionStore} from './src/connection';

const ink = '#153139';
const teal = '#087e79';
const documentTypes: Array<{code: DocumentType; label: string}> = [
  {code: 'RC', label: 'Registro Civil'}, {code: 'TI', label: 'Tarjeta de Identidad'},
  {code: 'CC', label: 'Cédula de Ciudadanía'}, {code: 'CE', label: 'Cédula de Extranjería'},
  {code: 'NIT', label: 'NIT'},
];

function App() {
  const [server, setServer] = useState(__DEV__ ? 'http://10.0.2.2:8080' : '');
  const [code, setCode] = useState('');
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [client, setClient] = useState<GatewayClient | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [challenge, setChallenge] = useState('');
  const [verification, setVerification] = useState('');
  const [resendAfter, setResendAfter] = useState(0);
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [screen, setScreen] = useState<'home' | 'list' | 'lookup' | 'create' | 'created' | 'detail' | 'agenda' | 'event' | 'invitations' | 'notifications' | 'notificationPreferences' | 'profile' | 'switch'>('home');
  const [switchCode, setSwitchCode] = useState('');
  const [switchTarget, setSwitchTarget] = useState<Organization | null>(null);
  const [switchAccepted, setSwitchAccepted] = useState(false);
  const [switchUnconfirmed, setSwitchUnconfirmed] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePresence, setProfilePresence] = useState<Principal['user']['presence']>('online');
  const [listQuery, setListQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [personPage, setPersonPage] = useState<PersonPage | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [detailBack, setDetailBack] = useState<'list' | 'lookup' | 'created'>('list');
  const [documentType, setDocumentType] = useState<DocumentType>('CC');
  const [documentNumber, setDocumentNumber] = useState('');
  const [lookupEmpty, setLookupEmpty] = useState(false);
  const [draft, setDraft] = useState<PendingPersonInput>({documentType: 'CC', documentNumber: '', firstNames: '', lastNames: '', authorizationBasis: '', authorizationPurpose: ''});
  const [createdId, setCreatedId] = useState<string | null>(null);
  const savingPerson = useRef(false);
  const [agendaAnchor, setAgendaAnchor] = useState(bogotaToday);
  const [agendaEvents, setAgendaEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventBack, setEventBack] = useState<'agenda' | 'invitations' | 'notifications'>('agenda');
  const [invitationPage, setInvitationPage] = useState<InvitationPage | null>(null);
  const respondingInvitation = useRef(false);
  const [notificationInbox, setNotificationInbox] = useState<NotificationInbox | null>(null);
  const changingNotice = useRef(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
  const [preferencesUnconfirmed, setPreferencesUnconfirmed] = useState(false);
  const savingPreferences = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const checkingForegroundSession = useRef(false);
  const [foregroundChecking, setForegroundChecking] = useState(false);
  const [foregroundError, setForegroundError] = useState('');
  const [foregroundRetry, setForegroundRetry] = useState(0);
  const lastForegroundRetry = useRef(0);

  const expireSession = useCallback(() => {
    setPrincipal(null); setDashboard(null); setPersonPage(null); setPerson(null); setScreen('home');
    setDocumentNumber(''); setLookupEmpty(false);
    setDraft({documentType: 'CC', documentNumber: '', firstNames: '', lastNames: '', authorizationBasis: '', authorizationPurpose: ''});
    setCreatedId(null);
    setAgendaEvents([]); setSelectedEvent(null); setInvitationPage(null); setNotificationInbox(null); setNotificationPreferences(null);
    setSwitchTarget(null); setSwitchAccepted(false); setSwitchUnconfirmed(false);
    setForegroundChecking(false); setForegroundError('');
    setError('Tu sesión terminó. Ingresa de nuevo.');
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      setRestoring(true);
      setRestoreError('');
      try {
        const saved = await connectionStore.load();
        if (!saved.origin || !saved.code) return;
        const origin = normalizeOrigin(saved.origin, __DEV__);
        const gateway = new GatewayClient(origin);
        const found = await gateway.organization(saved.code);
        if (cancelled) return;
        setServer(origin); setCode(found.code); setOrganization(found); setClient(gateway);
        try {
          const current = await gateway.me();
          if (cancelled) return;
          if (current.organization.code !== found.code) throw new Error('La sesión pertenece a otra junta. Ingresa de nuevo.');
          setPrincipal(current);
          if (current.terms_required) {
            setSwitchTarget(current.organization); setSwitchCode(current.organization.code);
            setSwitchAccepted(false); setScreen('switch');
            return;
          }
          try {setDashboard(await gateway.dashboard());}
          catch (cause) {
            if (cause instanceof ApiError && cause.status === 401) {
              setPrincipal(null);
            } else {
              setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.');
            }
          }
        } catch (cause) {
          if (!(cause instanceof ApiError && cause.status === 401)) throw cause;
        }
      } catch (cause) {
        if (!cancelled) setRestoreError(cause instanceof Error ? cause.message : 'No se pudo comprobar la sesión.');
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }
    void restore();
    return () => {cancelled = true;};
  }, [restoreAttempt]);

  useEffect(() => {
    if (!client || !principal) return;
    let listening = true;
    function checkSession() {
      if (checkingForegroundSession.current) return;
      checkingForegroundSession.current = true;
      setForegroundChecking(true);
      setForegroundError('');
      client!.me().then(current => {
        if (!listening) return;
        if (current.user_id !== principal!.user_id || current.organization.code !== principal!.organization.code) {
          expireSession();
        } else {
          setPrincipal(current);
          if (current.terms_required) {
            setSwitchTarget(current.organization); setSwitchCode(current.organization.code);
            setSwitchAccepted(false); setScreen('switch');
          }
          setError('');
        }
      }).catch(cause => {
        if (!listening) return;
        if (cause instanceof ApiError && cause.status === 401) expireSession();
        else setForegroundError('No se pudo comprobar la sesión. Comprueba tu conexión y vuelve a intentarlo.');
      }).finally(() => {
        checkingForegroundSession.current = false;
        setForegroundChecking(false);
      });
    }
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') checkSession();
    });
    if (foregroundRetry > lastForegroundRetry.current) {
      lastForegroundRetry.current = foregroundRetry;
      checkSession();
    }
    return () => {listening = false; subscription.remove();};
  }, [client, principal, expireSession, foregroundRetry]);

  useEffect(() => {
    if (resendAfter <= 0) return;
    const timer = setTimeout(() => setResendAfter(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendAfter]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await task(); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401 && principal) {
        expireSession();
      } else {
        setError(cause instanceof Error ? cause.message : 'Ocurrió un error inesperado.');
      }
    }
    finally { setBusy(false); }
  }
  function resetOrganization() {
    setOrganization(null); setClient(null); setAccepted(false);
    setChallenge(''); setPrincipal(null); setDashboard(null);
    setPersonPage(null); setPerson(null); setScreen('home');
    setDocumentNumber(''); setLookupEmpty(false);
    clearDraft();
    setAgendaEvents([]); setSelectedEvent(null); setInvitationPage(null); setNotificationInbox(null); setNotificationPreferences(null);
    setSwitchTarget(null); setSwitchAccepted(false); setSwitchUnconfirmed(false);
    setRecovering(false); setShowPassword(false); setPassword('');
  }
  function changeOrganization() {
    run(async () => {
      await connectionStore.clear();
      resetOrganization(); setCode('');
    });
  }
  function findOrganization() {
    run(async () => {
      if (!code.trim()) throw new Error('Ingresa el código de tu junta.');
      const gateway = new GatewayClient(normalizeOrigin(server, __DEV__));
      const found = await gateway.organization(code);
      setOrganization(found); setClient(gateway);
      try {await connectionStore.save(normalizeOrigin(server, __DEV__), found.code);}
      catch {setNotice('No se pudo recordar la junta en este dispositivo; tendrás que seleccionarla al reabrir.');}
    });
  }
  function login() {
    run(async () => {
      if (!client || !organization) throw new Error('Primero identifica tu junta.');
      if (!accepted) throw new Error('Lee y acepta los términos de tu junta.');
      if (!email.trim() || !password) throw new Error('Ingresa correo y contraseña.');
      const response = await client.login(email, password, organization);
      setChallenge(response.challenge_id); setResendAfter(response.resend_after);
      setPassword(''); setNotice('Enviamos un código de verificación a tu correo.');
    });
  }
  function recover() {
    run(async () => {
      if (!client || !organization) throw new Error('Primero identifica tu junta.');
      if (!email.trim()) throw new Error('Ingresa tu correo electrónico.');
      const response = await client.recover(email, organization);
      setNotice(response.message);
    });
  }
  function verify() {
    run(async () => {
      if (!client) return;
      if (!/^\d{6}$/.test(verification.trim())) throw new Error('Ingresa los seis dígitos del código.');
      const person = await client.verify(challenge, verification.trim());
      setPrincipal(person); setChallenge(''); setVerification(''); setScreen('home');
      if (person.terms_required) {
        setSwitchTarget(person.organization); setSwitchCode(person.organization.code);
        setSwitchAccepted(false); setScreen('switch');
        return;
      }
      try { setDashboard(await client.dashboard()); }
      catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) {
          setPrincipal(null); setError('Tu sesión terminó. Ingresa de nuevo.');
        } else {
          setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.');
        }
      }
    });
  }
  function resend() {
    run(async () => {
      if (!client || resendAfter > 0) return;
      const response = await client.resend(challenge);
      setChallenge(response.challenge_id); setResendAfter(response.resend_after);
      setVerification(''); setNotice('Enviamos un nuevo código. El anterior ya no funciona.');
    });
  }
  function cancel() {
    run(async () => {
      if (!client) return;
      await client.cancel(challenge); setChallenge(''); setVerification('');
    });
  }
  function logout() {
    run(async () => {
      if (!client) return;
      await client.logout(); setPrincipal(null); setDashboard(null);
      setPersonPage(null); setPerson(null); setScreen('home');
      setDocumentNumber(''); setLookupEmpty(false);
      clearDraft();
      setAgendaEvents([]); setSelectedEvent(null); setInvitationPage(null); setNotificationInbox(null); setNotificationPreferences(null);
      setSwitchTarget(null); setSwitchAccepted(false); setSwitchUnconfirmed(false);
      setAccepted(false); setNotice('Sesión cerrada.');
    });
  }
  function openSwitch() {
    setSwitchCode(''); setSwitchTarget(null); setSwitchAccepted(false); setSwitchUnconfirmed(false);
    setScreen('switch'); setError(''); setNotice('');
  }
  function findSwitchTarget() {
    run(async () => {
      if (!client || !principal) return;
      const codeToFind = principal.terms_required ? principal.organization.code : switchCode.trim();
      if (!codeToFind) throw new Error('Ingresa el código de la junta destino.');
      const target = await client.organization(codeToFind);
      setSwitchTarget(target); setSwitchCode(target.code); setSwitchAccepted(false);
    });
  }
  async function adoptVerifiedOrganization(gateway: GatewayClient, current: Principal) {
    setPersonPage(null); setPerson(null); setListQuery(''); setAppliedQuery('');
    setDocumentNumber(''); setLookupEmpty(false); clearDraft();
    setAgendaEvents([]); setSelectedEvent(null); setInvitationPage(null);
    setNotificationInbox(null); setNotificationPreferences(null); setPreferencesUnconfirmed(false);
    setProfileName(''); setProfilePresence('online'); setDashboard(null);
    setPrincipal(current); setOrganization(current.organization); setCode(current.organization.code);
    setSwitchCode(current.organization.code); setSwitchTarget(current.terms_required ? current.organization : null);
    setSwitchAccepted(false); setSwitchUnconfirmed(false); setAccepted(false);
    setScreen(current.terms_required ? 'switch' : 'home');
    try {await connectionStore.save(normalizeOrigin(server, __DEV__), current.organization.code);}
    catch {setNotice('No se pudo recordar la junta nueva en este dispositivo.');}
    if (!current.terms_required) {
      try {setDashboard(await gateway.dashboard());}
      catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) throw cause;
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.');
      }
    }
  }
  async function reconcileSwitch() {
    if (!client || !principal) return;
    const current = await client.me();
    if (current.user_id !== principal.user_id) throw new Error('La cuenta activa cambió. Cierra sesión e ingresa de nuevo.');
    if (switchTarget && current.organization.code === principal.organization.code
      && switchTarget.code !== current.organization.code) {
      setSwitchUnconfirmed(false); setSwitchTarget(null); setSwitchAccepted(false);
      setScreen('home'); setNotice('El cambio no se aplicó; sigues en tu junta anterior.');
      return;
    }
    await adoptVerifiedOrganization(client, current);
  }
  function confirmSwitch() {
    if (switchUnconfirmed) return;
    run(async () => {
      if (!client || !switchTarget || !switchAccepted) throw new Error('Lee y acepta los términos vigentes de la junta.');
      try {await client.switchOrganization(switchTarget);}
      catch (cause) {
        if (cause instanceof UnconfirmedWriteError) setSwitchUnconfirmed(true);
        if (cause instanceof ApiError && cause.status === 409) {
          setSwitchTarget(null); setSwitchAccepted(false);
        }
        throw cause;
      }
      setSwitchUnconfirmed(true);
      await reconcileSwitch();
    });
  }
  function checkSwitch() {
    run(reconcileSwitch);
  }
  function openProfile() {
    run(async () => {
      if (!client) return;
      const current = await client.me();
      setPrincipal(current);
      setProfileName(current.user.name);
      setProfilePresence(current.user.presence);
      setScreen('profile');
    });
  }
  function saveProfile() {
    run(async () => {
      if (!client || !principal) return;
      const saved = await client.updateProfile({name: profileName, presence: profilePresence, theme: principal.user.theme});
      setPrincipal(current => current ? {...current, user: {...current.user, ...saved}} : current);
      setProfileName(saved.name);
      try {
        const current = await client.me();
        setPrincipal(current);
        setProfileName(current.user.name);
        setProfilePresence(current.user.presence);
        setNotice('Perfil guardado.');
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) throw cause;
        setNotice('Perfil guardado. No se pudo actualizar su lectura; vuelve a abrirlo para comprobar el estado.');
      }
    });
  }
  function loadPeople(page: number, query: string) {
    run(async () => {
      if (!client) return;
      const result = await client.persons(page, query);
      setPersonPage(result); setAppliedQuery(query.trim()); setScreen('list');
    });
  }
  function openPerson(id: string) {
    run(async () => {
      if (!client) return;
      const result = await client.person(id);
      setPerson(result); setDetailBack('list'); setScreen('detail');
    });
  }
  function lookupPerson() {
    run(async () => {
      if (!client) return;
      const result = await client.lookupPerson(documentType, documentNumber);
      if (result) {
        setPerson(result); setLookupEmpty(false); setDetailBack('lookup'); setScreen('detail');
      } else {
        setPerson(null); setLookupEmpty(true);
      }
    });
  }
  function clearDraft() {
    setDraft({documentType: 'CC', documentNumber: '', firstNames: '', lastNames: '', authorizationBasis: '', authorizationPurpose: ''});
    setCreatedId(null);
  }
  function updateDraft<K extends keyof PendingPersonInput>(key: K, value: PendingPersonInput[K]) {
    setDraft(current => ({...current, [key]: value}));
  }
  function createPendingPerson() {
    if (savingPerson.current || !client || createdId) return;
    savingPerson.current = true;
    run(async () => {
      const saved = await client.createPendingPerson(draft);
      setCreatedId(saved.id);
      setScreen('created');
    }).finally(() => {savingPerson.current = false;});
  }
  function openCreatedPerson() {
    run(async () => {
      if (!client || !createdId) return;
      const result = await client.person(createdId);
      setPerson(result); setDetailBack('created'); setScreen('detail');
    });
  }
  function loadAgenda(anchor: string) {
    run(async () => {
      if (!client) return;
      const result = await client.agenda(anchor);
      if (result.timezone !== 'America/Bogota' || !Array.isArray(result.items)) {
        throw new Error('El servidor devolvió una agenda no válida.');
      }
      setAgendaAnchor(anchor); setAgendaEvents(result.items); setScreen('agenda');
    });
  }
  function openEvent(id: string, back: 'agenda' | 'invitations' | 'notifications') {
    run(async () => {
      if (!client) return;
      const result = await client.calendarEvent(id);
      setSelectedEvent(result); setEventBack(back); setScreen('event');
    });
  }
  function loadInvitations(page: number) {
    run(async () => {
      if (!client) return;
      const result = await client.invitations(page);
      if (!Array.isArray(result.items)) throw new Error('El servidor devolvió invitaciones no válidas.');
      setInvitationPage(result); setScreen('invitations');
    });
  }
  function respondToInvitation(invitation: CalendarInvitation, response: 'accepted' | 'declined') {
    if (respondingInvitation.current || !client) return;
    respondingInvitation.current = true;
    run(async () => {
      try {
        await client.respondInvitation(invitation, response);
      } catch (cause) {
        try {setInvitationPage(await client.invitations(invitationPage?.page ?? 1));} catch { /* Conserva el error original. */ }
        throw cause;
      }
      setInvitationPage(current => current ? {...current, items: current.items.map(item => item.event_id === invitation.event_id
        ? {...item, response, response_version: item.response_version + 1} : item)} : current);
      setNotice(response === 'accepted' ? 'Asistencia confirmada.' : 'Invitación rechazada.');
      try {
        setInvitationPage(await client.invitations(invitationPage?.page ?? 1));
      } catch {
        setNotice('Respuesta guardada. No se pudo actualizar la lista; vuelve a abrirla para confirmar su estado.');
      }
    }).finally(() => {respondingInvitation.current = false;});
  }
  function loadNotifications(page: number) {
    run(async () => {
      if (!client) return;
      const result = await client.notifications(page);
      if (!Array.isArray(result.items)) throw new Error('El servidor devolvió avisos no válidos.');
      setNotificationInbox(result); setScreen('notifications');
    });
  }
  function openNotificationPreferences() {
    run(async () => {
      if (!client) return;
      const result = await client.notificationPreferences();
      setNotificationPreferences(result);
      setPreferencesUnconfirmed(false);
      setScreen('notificationPreferences');
    });
  }
  function saveNotificationPreferences() {
    if (savingPreferences.current || !client || !notificationPreferences || preferencesUnconfirmed) return;
    savingPreferences.current = true;
    run(async () => {
      try {
        const saved = await client.updateNotificationPreferences(notificationPreferences);
        setNotificationPreferences(saved);
        setNotice('Preferencias guardadas.');
      } catch (cause) {
        if (cause instanceof UnconfirmedWriteError) setPreferencesUnconfirmed(true);
        throw cause;
      }
    }).finally(() => {savingPreferences.current = false;});
  }
  function changeNotice(item: Notice, operation: 'read' | 'dismiss') {
    if (changingNotice.current || !client) return;
    changingNotice.current = true;
    run(async () => {
      const page = notificationInbox?.page ?? 1;
      try {
        if (operation === 'read') await client.markNotificationRead(item.id);
        else await client.dismissNotification(item.id);
      } catch (cause) {
        try {setNotificationInbox(await client.notifications(page));} catch { /* Conserva el error original. */ }
        throw cause;
      }
      setNotificationInbox(current => {
        if (!current) return current;
        if (operation === 'read') return {...current, unread: Math.max(0, current.unread - (item.read_at ? 0 : 1)),
          items: current.items.map(value => value.id === item.id ? {...value, read_at: new Date().toISOString()} : value)};
        return {...current, total: Math.max(0, current.total - 1), unread: Math.max(0, current.unread - (item.read_at ? 0 : 1)),
          items: current.items.filter(value => value.id !== item.id)};
      });
      setNotice(operation === 'read' ? 'Aviso marcado como leído.' : 'Aviso descartado de la bandeja.');
      const refreshedPage = operation === 'dismiss' && notificationInbox?.items.length === 1 && page > 1 ? page - 1 : page;
      try {setNotificationInbox(await client.notifications(refreshedPage));}
      catch {setNotice('Cambio guardado. No se pudo actualizar la lista; vuelve a abrirla para confirmar su estado.');}
    }).finally(() => {changingNotice.current = false;});
  }

  if (restoring || restoreError) return <SafeAreaProvider>
    <SafeAreaView style={styles.screen}><View style={styles.content}>
      <Text style={styles.title}>{restoring ? 'Comprobando sesión…' : 'No se pudo comprobar la sesión'}</Text>
      {restoring ? <ActivityIndicator /> : <>
        <Text style={styles.help}>{restoreError}</Text>
        <Action label="Reintentar" onPress={() => setRestoreAttempt(value => value + 1)} />
        <Action label="Cambiar junta o servidor" onPress={() => {
          void connectionStore.clear().then(() => {
            setOrganization(null); setClient(null); setCode(''); setPrincipal(null);
            setRestoreError('');
          }).catch(() => setRestoreError('No se pudo borrar la junta guardada. Intenta de nuevo.'));
        }} secondary />
      </>}
    </View></SafeAreaView>
  </SafeAreaProvider>;

  if (principal && (foregroundChecking || foregroundError)) return <SafeAreaProvider>
    <SafeAreaView style={styles.screen}><View style={styles.content}>
      <Text style={styles.title}>{foregroundChecking ? 'Comprobando sesión…' : 'No se pudo comprobar la sesión'}</Text>
      {foregroundChecking ? <ActivityIndicator /> : <>
        <Text style={styles.help}>{foregroundError}</Text>
        <Action label="Reintentar" onPress={() => setForegroundRetry(value => value + 1)} />
      </>}
    </View></SafeAreaView>
  </SafeAreaProvider>;

  return <SafeAreaProvider>
    <StatusBar barStyle="dark-content" />
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}><Text style={styles.brandMark}>SRD</Text><Text style={styles.brandDetail}>Sistema de Registro Digital</Text></View>
        {!principal && !challenge && <>
          <Text style={styles.eyebrow}>ACCESO INTERNO</Text><Text style={styles.title}>{recovering ? 'Recuperar acceso' : 'Iniciar sesión'}</Text>
          <Text style={styles.lead}>{recovering ? 'Escribe el correo de tu cuenta para solicitar instrucciones.' : 'Accede al espacio de trabajo de tu junta.'}</Text>
          {!organization ? <View style={styles.card}>
            <Text style={styles.heading}>Identifica tu junta</Text>
            <Text style={styles.help}>El administrador te proporciona el código de junta. Para pruebas en el emulador, el servidor local usa 10.0.2.2.</Text>
            <Field label="Dirección del servidor" value={server} onChangeText={value => {setServer(value); resetOrganization();}} placeholder="https://srd.ejemplo.com" autoCapitalize="none" keyboardType="url" />
            <Field label="Código de junta" value={code} onChangeText={value => {setCode(value); resetOrganization();}} placeholder="Código asignado" autoCapitalize="none" />
            <Action label="Continuar" onPress={findOrganization} disabled={busy} />
          </View> : <View style={styles.card}>
            <Text style={styles.organization}>{organization.name}</Text>
            <Pressable onPress={changeOrganization} disabled={busy}><Text style={styles.link}>Cambiar junta o servidor</Text></Pressable>
            <Field label="Correo electrónico" value={email} onChangeText={setEmail} placeholder="tu@correo.com" autoCapitalize="none" keyboardType="email-address" />
            {recovering ? <>
              <Text style={styles.help}>Te enviaremos instrucciones si la cuenta está habilitada. El enlace de recuperación se abre en la web de SRD.</Text>
              <Action label="Enviar instrucciones" onPress={recover} disabled={busy} />
              <Pressable onPress={() => {setRecovering(false); setError(''); setNotice('');}} disabled={busy}><Text style={styles.link}>Volver al inicio de sesión</Text></Pressable>
            </> : <>
              <Field label="Contraseña" value={password} onChangeText={setPassword} placeholder="Contraseña" secureTextEntry={!showPassword} />
              <Pressable onPress={() => setShowPassword(value => !value)} accessibilityRole="button"><Text style={styles.link}>{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</Text></Pressable>
              <Pressable style={styles.checkboxRow} onPress={() => setAccepted(value => !value)} accessibilityRole="checkbox" accessibilityState={{checked: accepted}}>
                <Text style={styles.checkbox}>{accepted ? '☑' : '□'}</Text><Text style={styles.checkboxLabel}>Acepto los términos vigentes de mi junta</Text>
              </Pressable>
              <Pressable onPress={() => setShowTerms(true)}><Text style={styles.link}>Leer términos (versión {organization.terms.version})</Text></Pressable>
              <Pressable onPress={() => {setRecovering(true); setPassword(''); setShowPassword(false); setError(''); setNotice('');}} disabled={busy}><Text style={styles.link}>Olvidé mi contraseña</Text></Pressable>
              <Action label="Ingresar" onPress={login} disabled={busy} />
            </>}
          </View>}
        </>}
        {!principal && !!challenge && <>
          <Text style={styles.eyebrow}>VERIFICACIÓN</Text><Text style={styles.title}>Revisa tu correo</Text>
          <Text style={styles.lead}>Ingresa el código de seis dígitos enviado a {email}.</Text>
          <View style={styles.card}>
            <Field label="Código de verificación" value={verification} onChangeText={setVerification} placeholder="000000" keyboardType="number-pad" maxLength={6} />
            <Action label="Verificar y entrar" onPress={verify} disabled={busy} />
            <Pressable onPress={resend} disabled={busy || resendAfter > 0}><Text style={styles.link}>{resendAfter > 0 ? `Reenviar en ${resendAfter} s` : 'Reenviar código'}</Text></Pressable>
            <Pressable onPress={cancel} disabled={busy}><Text style={styles.link}>Volver al inicio de sesión</Text></Pressable>
          </View>
        </>}
        {!!principal && screen === 'home' && <>
          <Text style={styles.eyebrow}>{principal.organization.name.toUpperCase()}</Text>
          <Text style={styles.title}>Hola, {principal.user.name}</Text>
          <Text style={styles.lead}>Resumen de registros de tu junta.</Text>
          {dashboard ? <View style={styles.stats}>
            <Stat label="Total" value={dashboard.total} /><Stat label="Hoy" value={dashboard.today} />
            <Stat label="Esta semana" value={dashboard.week} /><Stat label="Este mes" value={dashboard.month} />
          </View> : <View style={styles.card}><Text style={styles.help}>El resumen no está disponible.</Text><Action label="Reintentar" onPress={() => run(async () => {if (client) setDashboard(await client.dashboard());})} disabled={busy} /></View>}
          <Action label="Consultar personas" onPress={() => {setListQuery(''); loadPeople(1, '');}} disabled={busy} />
          <Action label="Consultar por documento" onPress={() => {setLookupEmpty(false); setScreen('lookup');}} disabled={busy} secondary />
          {['superadmin', 'admin', 'registrar'].includes(principal.role) && <Action label="Registrar persona" onPress={() => {clearDraft(); setScreen('create');}} disabled={busy} secondary />}
          <Action label="Agenda" onPress={() => loadAgenda(bogotaToday())} disabled={busy} secondary />
          <Action label="Mis invitaciones" onPress={() => loadInvitations(1)} disabled={busy} secondary />
          <Action label="Notificaciones" onPress={() => loadNotifications(1)} disabled={busy} secondary />
          <Action label="Mi perfil" onPress={openProfile} disabled={busy} secondary />
          <Action label="Cambiar de junta" onPress={openSwitch} disabled={busy} secondary />
          <Action label="Cerrar sesión" onPress={logout} disabled={busy} secondary />
        </>}
        {!!principal && screen === 'switch' && <SwitchOrganizationScreen current={principal.organization}
          code={switchCode} target={switchTarget} accepted={switchAccepted} busy={busy}
          required={principal.terms_required} unconfirmed={switchUnconfirmed}
          onCode={value => {setSwitchCode(value); setSwitchTarget(null); setSwitchAccepted(false);}}
          onFind={findSwitchTarget} onAccepted={setSwitchAccepted} onSwitch={confirmSwitch}
          onCheck={checkSwitch} onBack={() => setScreen('home')} onLogout={logout} />}
        {!!principal && screen === 'profile' && <ProfileScreen principal={principal} name={profileName}
          presence={profilePresence} busy={busy} onName={setProfileName} onPresence={setProfilePresence}
          onSave={saveProfile} onBack={() => setScreen('home')} />}
        {!!principal && screen === 'agenda' && <AgendaScreen
          {...agendaWindow(agendaAnchor)} events={agendaEvents} busy={busy}
          onMove={weeks => loadAgenda(addCalendarDays(agendaAnchor, weeks * 7))}
          onRefresh={() => loadAgenda(agendaAnchor)} onOpen={id => openEvent(id, 'agenda')} onBack={() => setScreen('home')}
        />}
        {!!principal && screen === 'invitations' && !!invitationPage && <InvitationScreen
          page={invitationPage} busy={busy} onOpen={id => openEvent(id, 'invitations')}
          onRespond={respondToInvitation} onPage={loadInvitations} onBack={() => setScreen('home')}
        />}
        {!!principal && screen === 'notifications' && !!notificationInbox && <NotificationsScreen
          inbox={notificationInbox} busy={busy}
          onRead={item => changeNotice(item, 'read')} onDismiss={item => changeNotice(item, 'dismiss')}
          onOpenEvent={id => openEvent(id, 'notifications')}
          onPage={loadNotifications} onRefresh={() => loadNotifications(notificationInbox.page)}
          onPreferences={openNotificationPreferences} onBack={() => setScreen('home')}
        />}
        {!!principal && screen === 'notificationPreferences' && !!notificationPreferences && <NotificationPreferencesScreen
          draft={notificationPreferences} busy={busy} unconfirmed={preferencesUnconfirmed}
          onChange={setNotificationPreferences} onSave={saveNotificationPreferences} onBack={() => setScreen('notifications')}
        />}
        {!!principal && screen === 'event' && !!selectedEvent && <EventScreen event={selectedEvent} busy={busy} onBack={() => {setSelectedEvent(null); setScreen(eventBack);}} />}
        {!!principal && screen === 'list' && <>
          <Text style={styles.eyebrow}>{principal.organization.name.toUpperCase()}</Text>
          <Text style={styles.title}>Personas</Text>
          <Text style={styles.lead}>Busca por nombre, apellido o número de documento.</Text>
          <View style={styles.card}>
            <Field label="Buscar personas" value={listQuery} onChangeText={setListQuery} placeholder="Nombre o documento" maxLength={120} />
            <Action label="Buscar" onPress={() => loadPeople(1, listQuery)} disabled={busy} />
            {!!appliedQuery && <Pressable onPress={() => {setListQuery(''); loadPeople(1, '');}} disabled={busy}><Text style={styles.link}>Limpiar búsqueda</Text></Pressable>}
          </View>
          <Text style={styles.help}>{personPage?.total ?? 0} resultado(s)</Text>
          {personPage?.items.length === 0 && <View style={styles.card}><Text style={styles.help}>No encontramos personas con estos criterios.</Text></View>}
          {personPage?.items.map(item => <Pressable key={item.id} style={styles.personCard} onPress={() => openPerson(item.id)} disabled={busy} accessibilityRole="button">
            <Text style={styles.personName}>{item.first_names} {item.last_names}</Text>
            <Text style={styles.personMeta}>{item.document_type} · {item.document_number}</Text>
            <Text style={styles.personMeta}>{item.status === 'complete' ? 'Completado' : 'Pendiente'} · Ver ficha</Text>
          </Pressable>)}
          {!!personPage && personPage.total > 0 && <View style={styles.pager}>
            <Pressable onPress={() => loadPeople(personPage.page - 1, appliedQuery)} disabled={busy || personPage.page <= 1}><Text style={[styles.link, (busy || personPage.page <= 1) && styles.disabled]}>Anterior</Text></Pressable>
            <Text style={styles.help}>Página {personPage.page} de {Math.ceil(personPage.total / personPage.page_size)}</Text>
            <Pressable onPress={() => loadPeople(personPage.page + 1, appliedQuery)} disabled={busy || personPage.page * personPage.page_size >= personPage.total}><Text style={[styles.link, (busy || personPage.page * personPage.page_size >= personPage.total) && styles.disabled]}>Siguiente</Text></Pressable>
          </View>}
          <Action label="Volver al resumen" onPress={() => setScreen('home')} disabled={busy} secondary />
        </>}
        {!!principal && screen === 'lookup' && <>
          <Text style={styles.eyebrow}>{principal.organization.name.toUpperCase()}</Text>
          <Text style={styles.title}>Consultar por documento</Text>
          <Text style={styles.lead}>La búsqueda exacta se hace dentro de tu junta.</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Tipo de documento</Text>
            <DocumentPicker value={documentType} onChange={value => {setDocumentType(value); setLookupEmpty(false);}} />
            <Field label="Número de documento" value={documentNumber} onChangeText={value => {setDocumentNumber(value); setLookupEmpty(false);}} placeholder="Conserva los ceros iniciales" maxLength={30} autoCapitalize="characters" />
            <Action label="Consultar" onPress={lookupPerson} disabled={busy} />
          </View>
          {lookupEmpty && <View style={styles.card}><Text style={styles.help}>No hay una persona con ese tipo y número de documento en tu junta.</Text></View>}
          <Action label="Volver al resumen" onPress={() => setScreen('home')} disabled={busy} secondary />
        </>}
        {!!principal && screen === 'create' && <>
          <Text style={styles.eyebrow}>{principal.organization.name.toUpperCase()}</Text>
          <Text style={styles.title}>Registrar persona</Text>
          <Text style={styles.lead}>Guarda un registro pendiente con los datos mínimos. Podrás completar la ficha después.</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Tipo de documento</Text>
            <DocumentPicker value={draft.documentType} onChange={value => updateDraft('documentType', value)} />
            <Field label="Número de documento *" value={draft.documentNumber} onChangeText={value => updateDraft('documentNumber', value)} placeholder="Conserva los ceros iniciales" maxLength={30} autoCapitalize="characters" />
            <Field label="Nombres *" value={draft.firstNames} onChangeText={value => updateDraft('firstNames', value)} maxLength={120} />
            <Field label="Apellidos" value={draft.lastNames} onChangeText={value => updateDraft('lastNames', value)} maxLength={120} />
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>Autorización de tratamiento</Text>
            <Text style={styles.help}>Registra el soporte real y la finalidad de la captura. Aceptar los términos de la cuenta no sustituye la autorización de esta persona.</Text>
            <Field label="Fundamento o referencia del soporte *" value={draft.authorizationBasis} onChangeText={value => updateDraft('authorizationBasis', value)} maxLength={120} />
            <Field label="Finalidad de la captura *" value={draft.authorizationPurpose} onChangeText={value => updateDraft('authorizationPurpose', value)} maxLength={1000} multiline numberOfLines={3} />
          </View>
          <Action label="Guardar como pendiente" onPress={createPendingPerson} disabled={busy} />
          <Action label="Volver al resumen" onPress={() => {clearDraft(); setScreen('home');}} disabled={busy} secondary />
        </>}
        {!!principal && screen === 'created' && !!createdId && <>
          <Text style={styles.eyebrow}>REGISTRO GUARDADO</Text>
          <Text style={styles.title}>Persona registrada</Text>
          <Text style={styles.lead}>El registro quedó pendiente. Completa los datos restantes desde la web o Windows.</Text>
          <View style={styles.card}>
            <Text style={styles.personName}>{draft.firstNames} {draft.lastNames}</Text>
            <Text style={styles.personMeta}>{draft.documentType} · {draft.documentNumber}</Text>
            <Text style={styles.help}>El alta ya fue confirmada. No vuelvas a enviarla.</Text>
          </View>
          <Action label="Ver ficha" onPress={openCreatedPerson} disabled={busy} />
          <Action label="Volver al resumen" onPress={() => {clearDraft(); setScreen('home');}} disabled={busy} secondary />
        </>}
        {!!principal && screen === 'detail' && !!person && <>
          <Text style={styles.eyebrow}>FICHA DE PERSONA</Text>
          <Text style={styles.title}>{person.first_names} {person.last_names}</Text>
          <Text style={styles.lead}>{person.status === 'complete' ? 'Registro completado' : 'Registro pendiente'}</Text>
          <View style={styles.card}>
            <Detail label="Documento" value={`${person.document_type} · ${person.document_number}`} />
            <Detail label="Afiliación" value={person.affiliated == null ? null : person.affiliated ? 'Sí' : 'No'} />
            <Detail label="Zona" value={person.zone === 'urban' ? 'Urbana' : person.zone === 'rural' ? 'Rural' : null} />
            <Detail label="Dirección" value={person.address} />
            <Detail label="Barrio" value={person.neighborhood} />
            <Detail label="Predio" value={person.property_name} />
            <Detail label="Fecha de nacimiento" value={person.birth_date} />
            <Detail label="Cargo" value={person.position_label} />
            <Detail label="Teléfono" value={person.phone} />
            <Detail label="Correo" value={person.email} />
          </View>
          <Action label={detailBack === 'lookup' ? 'Volver a la consulta' : detailBack === 'created' ? 'Volver al registro guardado' : 'Volver a la lista'} onPress={() => {setPerson(null); setScreen(detailBack);}} disabled={busy} secondary />
        </>}
        {busy && <ActivityIndicator style={styles.busy} color={teal} accessibilityLabel="Cargando" />}
        {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
      </ScrollView>
    </SafeAreaView>
    <Modal visible={showTerms} animationType="slide" onRequestClose={() => setShowTerms(false)}>
      <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Términos de {organization?.name}</Text>
        <Text style={styles.terms}>{organization?.terms.body}</Text>
        <Action label="Cerrar" onPress={() => setShowTerms(false)} />
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaProvider>;
}

type FieldProps = React.ComponentProps<typeof TextInput> & {label: string};
function Field({label, ...props}: FieldProps) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} placeholderTextColor="#82979b" {...props} /></View>;
}
function Action({label, onPress, disabled, secondary = false}: {label: string; onPress: () => void; disabled?: boolean; secondary?: boolean}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text></Pressable>;
}
function Stat({label, value}: {label: string; value: number}) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function Detail({label, value}: {label: string; value?: string | null}) {
  if (!value) return null;
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}
function DocumentPicker({value, onChange}: {value: DocumentType; onChange: (value: DocumentType) => void}) {
  return <View style={styles.typeChoices}>{documentTypes.map(type => <Pressable key={type.code} accessibilityRole="radio" accessibilityState={{selected: value === type.code}} onPress={() => onChange(type.code)} style={[styles.typeChoice, value === type.code && styles.typeChoiceSelected]}>
    <Text style={[styles.typeChoiceText, value === type.code && styles.typeChoiceTextSelected]}>{type.label}</Text>
  </Pressable>)}</View>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#f3f7f6'},
  content: {padding: 24, paddingBottom: 48, gap: 14},
  brand: {flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 24},
  brandMark: {backgroundColor: teal, color: '#fff', fontSize: 16, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9},
  brandDetail: {color: ink, fontWeight: '700', fontSize: 13},
  eyebrow: {color: teal, fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {color: ink, fontSize: 32, fontWeight: '800', lineHeight: 38},
  lead: {color: '#577078', fontSize: 16, lineHeight: 23, marginBottom: 10},
  card: {backgroundColor: '#fff', padding: 20, borderRadius: 20, gap: 14, elevation: 2},
  heading: {color: ink, fontSize: 20, fontWeight: '700'},
  organization: {color: ink, fontSize: 20, fontWeight: '700'},
  help: {color: '#577078', lineHeight: 21},
  field: {gap: 7}, label: {color: ink, fontWeight: '700'},
  input: {borderWidth: 1, borderColor: '#cbd9d9', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11, color: ink, backgroundColor: '#fff'},
  button: {backgroundColor: teal, paddingVertical: 15, borderRadius: 11, alignItems: 'center', marginTop: 5},
  buttonSecondary: {backgroundColor: '#fff', borderWidth: 1, borderColor: teal},
  buttonText: {color: '#fff', fontWeight: '800', fontSize: 16}, buttonTextSecondary: {color: teal},
  disabled: {opacity: 0.5}, link: {color: teal, fontWeight: '700', paddingVertical: 5},
  checkboxRow: {flexDirection: 'row', alignItems: 'center', gap: 8}, checkbox: {fontSize: 23, color: teal}, checkboxLabel: {color: ink, flex: 1},
  stats: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12},
  stat: {width: '47%', backgroundColor: '#fff', padding: 18, borderRadius: 16, elevation: 1},
  statValue: {fontSize: 28, color: ink, fontWeight: '800'}, statLabel: {color: '#577078'},
  personCard: {backgroundColor: '#fff', padding: 18, borderRadius: 14, gap: 5, elevation: 1},
  personName: {color: ink, fontSize: 17, fontWeight: '700'}, personMeta: {color: '#577078'},
  pager: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  detailRow: {borderBottomWidth: 1, borderBottomColor: '#e8eeee', paddingBottom: 10, gap: 3},
  detailLabel: {color: '#577078', fontSize: 12, fontWeight: '700'}, detailValue: {color: ink, fontSize: 16},
  typeChoices: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  typeChoice: {borderWidth: 1, borderColor: '#cbd9d9', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9},
  typeChoiceSelected: {backgroundColor: teal, borderColor: teal},
  typeChoiceText: {color: ink, fontSize: 12}, typeChoiceTextSelected: {color: '#fff', fontWeight: '700'},
  busy: {marginTop: 4}, error: {color: '#a42e31', backgroundColor: '#ffebeb', padding: 12, borderRadius: 8},
  notice: {color: '#195e4d', backgroundColor: '#e3f5ec', padding: 12, borderRadius: 8},
  terms: {color: ink, lineHeight: 23, fontSize: 15},
});

export default App;
