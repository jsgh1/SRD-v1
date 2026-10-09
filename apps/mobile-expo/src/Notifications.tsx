import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {bogotaDateTime} from './calendar';
import {type Notice, type NotificationInbox, type NotificationKind} from './notificationModels';

const kindNames: Record<NotificationKind, string> = {
  invitation: 'Invitación', event_changed: 'Cambio de evento', event_cancelled: 'Evento cancelado',
  reminder_24h: 'Recordatorio de 24 horas', reminder_1h: 'Recordatorio de 1 hora', chat_message: 'Chat',
};

function dateLabel(value: string): string {
  try {
    const {date, time} = bogotaDateTime(value);
    return `${date} · ${time}`;
  } catch {
    return 'Fecha no disponible';
  }
}

function Button({label, onPress, disabled = false}: {label: string; onPress: () => void; disabled?: boolean}) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.button, disabled && styles.disabled]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

export function NotificationsScreen({inbox, busy, onRead, onDismiss, onOpenEvent, onPage, onRefresh, onPreferences, onBack}: {
  inbox: NotificationInbox; busy: boolean;
  onRead: (item: Notice) => void; onDismiss: (item: Notice) => void; onOpenEvent: (id: string) => void;
  onPage: (page: number) => void; onRefresh: () => void; onPreferences: () => void; onBack: () => void;
}) {
  const [confirmDismiss, setConfirmDismiss] = useState<string | null>(null);
  return <>
    <Text style={styles.eyebrow}>BANDEJA PERSONAL</Text>
    <Text style={styles.title}>Notificaciones</Text>
    <Text style={styles.lead}>{inbox.unread} sin leer · {inbox.total} en total</Text>
    {inbox.items.length === 0 && <View style={styles.emptyCard}>
      <Text style={styles.emptyMark} accessibilityElementsHidden>✓</Text>
      <Text style={styles.emptyTitle}>{inbox.total === 0 ? 'Todo al día' : 'No hay avisos en esta página'}</Text>
      <Text style={styles.emptyHelp}>{inbox.total === 0 ? 'Las novedades de tu junta aparecerán aquí.' : 'Prueba otra página o actualiza la bandeja.'}</Text>
    </View>}
    {inbox.items.map(item => <View key={item.id} style={[styles.card, !item.read_at && styles.unread]}>
      <Text style={styles.kind}>{kindNames[item.kind] ?? item.kind}{!item.read_at ? ' · Sin leer' : ''}</Text>
      <Text style={styles.noticeTitle}>{item.title}</Text>
      <Text style={styles.muted}>{dateLabel(item.created_at)} · hora de Bogotá</Text>
      {item.event_id && <Pressable onPress={() => onOpenEvent(item.event_id!)} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Ver evento</Text></Pressable>}
      {item.kind === 'chat_message' && <Text style={styles.muted}>Abre Chat en web o Windows para ver la conversación.</Text>}
      {!item.read_at && <Pressable onPress={() => onRead(item)} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Marcar leído</Text></Pressable>}
      {confirmDismiss === item.id ? <View style={styles.confirm}>
        <Text style={styles.muted}>¿Descartar este aviso de la bandeja?</Text>
        <View style={styles.row}>
          <Pressable onPress={() => setConfirmDismiss(null)} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Cancelar</Text></Pressable>
          <Pressable onPress={() => {setConfirmDismiss(null); onDismiss(item);}} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Sí, descartar</Text></Pressable>
        </View>
      </View> : <Pressable onPress={() => setConfirmDismiss(item.id)} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Descartar</Text></Pressable>}
    </View>)}
    {inbox.total > inbox.page_size && <View style={styles.row}>
      <Pressable onPress={() => {setConfirmDismiss(null); onPage(inbox.page - 1);}} disabled={busy || inbox.page <= 1} accessibilityRole="button"><Text style={[styles.link, (busy || inbox.page <= 1) && styles.disabled]}>Anterior</Text></Pressable>
      <Text style={styles.muted}>Página {inbox.page}</Text>
      <Pressable onPress={() => {setConfirmDismiss(null); onPage(inbox.page + 1);}} disabled={busy || inbox.page * inbox.page_size >= inbox.total} accessibilityRole="button"><Text style={[styles.link, (busy || inbox.page * inbox.page_size >= inbox.total) && styles.disabled]}>Siguiente</Text></Pressable>
    </View>}
    <Button label="Actualizar avisos" onPress={onRefresh} disabled={busy} />
    <Button label="Preferencias de avisos" onPress={onPreferences} disabled={busy} />
    <Button label="Volver al resumen" onPress={onBack} disabled={busy} />
  </>;
}

const styles = StyleSheet.create({
  eyebrow: {color: '#087e79', fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {color: '#153139', fontSize: 32, fontWeight: '800'},
  lead: {color: '#577078', fontSize: 16, marginBottom: 8},
  card: {backgroundColor: '#fff', padding: 18, borderRadius: 14, gap: 7, elevation: 1},
  emptyCard: {backgroundColor: '#fff', padding: 24, borderRadius: 18, alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#e1ebea'},
  emptyMark: {color: '#087e79', backgroundColor: '#e4f3ef', textAlign: 'center', textAlignVertical: 'center', width: 44, height: 44, lineHeight: 44, borderRadius: 22, fontSize: 23, fontWeight: '700'},
  emptyTitle: {color: '#153139', fontSize: 18, fontWeight: '800'},
  emptyHelp: {color: '#577078', textAlign: 'center', lineHeight: 20},
  unread: {borderLeftWidth: 4, borderLeftColor: '#087e79'},
  kind: {color: '#087e79', fontWeight: '700', fontSize: 12},
  noticeTitle: {color: '#153139', fontSize: 17, fontWeight: '700'},
  muted: {color: '#577078', lineHeight: 20},
  link: {color: '#087e79', fontWeight: '700', paddingVertical: 5},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8},
  confirm: {backgroundColor: '#f3f7f6', borderRadius: 9, padding: 10, gap: 7},
  button: {backgroundColor: '#fff', borderWidth: 1, borderColor: '#087e79', borderRadius: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12},
  buttonText: {color: '#087e79', fontWeight: '700'}, disabled: {opacity: 0.5},
});
