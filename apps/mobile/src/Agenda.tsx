import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {bogotaDateTime, type CalendarEvent, type CalendarInvitation, type InvitationPage} from './calendar';

const typeNames: Record<CalendarEvent['type'], string> = {
  meeting: 'Reunión', appointment: 'Cita', activity: 'Actividad', important_date: 'Fecha importante',
};
const stateNames: Record<CalendarEvent['state'], string> = {
  scheduled: 'Programado', upcoming: 'Próximo', in_progress: 'En curso',
  finished: 'Finalizado', cancelled: 'Cancelado',
};
const responseNames = {pending: 'Pendiente', accepted: 'Aceptada', declined: 'Rechazada'};

function displayDate(instant: string): string {
  try {
    const {date, time} = bogotaDateTime(instant);
    return `${date} · ${time}`;
  } catch {
    return 'Fecha no disponible';
  }
}

function Button({label, onPress, disabled = false, secondary = false, compact = false}: {label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; compact?: boolean}) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.button, secondary && styles.secondary, compact && styles.compact, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

export function AgendaScreen({from, to, events, busy, onMove, onRefresh, onOpen, onBack}: {
  from: string; to: string; events: CalendarEvent[]; busy: boolean;
  onMove: (weeks: number) => void; onRefresh: () => void; onOpen: (id: string) => void; onBack: () => void;
}) {
  return <>
    <Text style={styles.eyebrow}>CALENDARIO DE LA JUNTA</Text>
    <Text style={styles.title}>Agenda</Text>
    <Text style={styles.lead}>Eventos del {from} al {to} · hora de Bogotá</Text>
    <View style={styles.controls}>
      <Button label="Semana anterior" onPress={() => onMove(-1)} disabled={busy} secondary compact />
      <Button label="Semana siguiente" onPress={() => onMove(1)} disabled={busy} secondary compact />
    </View>
    {events.length === 0 && <View style={styles.card}><Text style={styles.muted}>No hay eventos en esta semana.</Text></View>}
    {events.map(event => <Pressable key={event.id} style={styles.card} onPress={() => onOpen(event.id)} disabled={busy} accessibilityRole="button">
      <Text style={styles.date}>{displayDate(event.starts_at)}</Text>
      <Text style={styles.eventTitle}>{event.title}</Text>
      <Text style={styles.muted}>{typeNames[event.type] ?? event.type} · {stateNames[event.state] ?? event.state}</Text>
      {!!event.location && <Text style={styles.muted}>{event.location}</Text>}
    </Pressable>)}
    <Button label="Actualizar agenda" onPress={onRefresh} disabled={busy} secondary />
    <Button label="Volver al resumen" onPress={onBack} disabled={busy} secondary />
  </>;
}

export function EventScreen({event, busy, onBack}: {event: CalendarEvent; busy: boolean; onBack: () => void}) {
  return <>
    <Text style={styles.eyebrow}>{typeNames[event.type] ?? 'EVENTO'}</Text>
    <Text style={styles.title}>{event.title}</Text>
    <Text style={styles.lead}>{stateNames[event.state] ?? event.state}</Text>
    <View style={styles.card}>
      <Fact label="Inicio" value={displayDate(event.starts_at)} />
      <Fact label="Fin" value={displayDate(event.ends_at)} />
      <Fact label="Lugar" value={event.location} />
      <Fact label="Descripción" value={event.description} />
      {event.participants?.length > 0 && <View style={styles.fact}>
        <Text style={styles.factLabel}>Participantes</Text>
        {event.participants.map(participant => <Text key={participant.user_id} style={styles.factValue}>{participant.name} · {responseNames[participant.response] ?? participant.response}</Text>)}
      </View>}
    </View>
    <Button label="Volver a la agenda" onPress={onBack} disabled={busy} secondary />
  </>;
}

export function InvitationScreen({page, busy, onOpen, onRespond, onPage, onBack}: {
  page: InvitationPage; busy: boolean; onOpen: (id: string) => void;
  onRespond: (invitation: CalendarInvitation, response: 'accepted' | 'declined') => void;
  onPage: (page: number) => void; onBack: () => void;
}) {
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null);
  return <>
    <Text style={styles.eyebrow}>CALENDARIO PERSONAL</Text>
    <Text style={styles.title}>Mis invitaciones</Text>
    <Text style={styles.lead}>Eventos futuros de tu junta en los que participas.</Text>
    <Text style={styles.muted}>{page.total} invitación(es)</Text>
    {page.items.length === 0 && <View style={styles.card}><Text style={styles.muted}>No tienes invitaciones futuras.</Text></View>}
    {page.items.map(invitation => <View key={invitation.event_id} style={styles.card}>
      <Text style={styles.date}>{displayDate(invitation.starts_at)}</Text>
      <Text style={styles.eventTitle}>{invitation.title}</Text>
      <Text style={styles.muted}>Respuesta: {responseNames[invitation.response]}</Text>
      {!!invitation.location && <Text style={styles.muted}>{invitation.location}</Text>}
      <Pressable onPress={() => onOpen(invitation.event_id)} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Ver evento</Text></Pressable>
      {confirmDecline === invitation.event_id ? <View style={styles.confirm}>
        <Text style={styles.muted}>¿Rechazar esta invitación?</Text>
        <View style={styles.controls}>
          <Button label="Cancelar" onPress={() => setConfirmDecline(null)} disabled={busy} secondary compact />
          <Button label="Confirmar rechazo" onPress={() => {setConfirmDecline(null); onRespond(invitation, 'declined');}} disabled={busy} compact />
        </View>
      </View> : <View style={styles.controls}>
        {invitation.response !== 'accepted' && <Button label="Aceptar" onPress={() => onRespond(invitation, 'accepted')} disabled={busy} secondary compact />}
        {invitation.response !== 'declined' && <Button label="Rechazar" onPress={() => setConfirmDecline(invitation.event_id)} disabled={busy} secondary compact />}
      </View>}
    </View>)}
    {page.total > page.page_size && <View style={styles.controls}>
      <Button label="Anterior" onPress={() => {setConfirmDecline(null); onPage(page.page - 1);}} disabled={busy || page.page <= 1} secondary compact />
      <Text style={styles.pageLabel}>Página {page.page}</Text>
      <Button label="Siguiente" onPress={() => {setConfirmDecline(null); onPage(page.page + 1);}} disabled={busy || page.page * page.page_size >= page.total} secondary compact />
    </View>}
    <Button label="Volver al resumen" onPress={onBack} disabled={busy} secondary />
  </>;
}

function Fact({label, value}: {label: string; value?: string | null}) {
  if (!value) return null;
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  eyebrow: {color: '#087e79', fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {color: '#153139', fontSize: 32, fontWeight: '800', lineHeight: 38},
  lead: {color: '#577078', fontSize: 16, lineHeight: 23, marginBottom: 10},
  controls: {flexDirection: 'row', gap: 8},
  card: {backgroundColor: '#fff', padding: 18, borderRadius: 14, gap: 6, elevation: 1},
  date: {color: '#087e79', fontWeight: '700'},
  eventTitle: {color: '#153139', fontSize: 18, fontWeight: '700'},
  muted: {color: '#577078', lineHeight: 20},
  button: {backgroundColor: '#087e79', paddingVertical: 12, paddingHorizontal: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 44},
  compact: {flex: 1},
  secondary: {backgroundColor: '#fff', borderWidth: 1, borderColor: '#087e79'},
  buttonText: {color: '#fff', fontWeight: '700'}, secondaryText: {color: '#087e79'},
  disabled: {opacity: 0.5}, fact: {borderBottomWidth: 1, borderBottomColor: '#e8eeee', paddingBottom: 10, gap: 3},
  factLabel: {color: '#577078', fontSize: 12, fontWeight: '700'}, factValue: {color: '#153139', fontSize: 15},
  link: {color: '#087e79', fontWeight: '700', paddingVertical: 4},
  confirm: {backgroundColor: '#f3f7f6', padding: 10, borderRadius: 9, gap: 8},
  pageLabel: {color: '#577078', alignSelf: 'center'},
});
