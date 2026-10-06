import React from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {type NotificationPreferences} from './api';

function Choice({label, detail, checked, busy, onPress}: {
  label: string; detail?: string; checked: boolean; busy: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{checked, disabled: busy}}
    onPress={onPress} disabled={busy} style={styles.choice}>
    <Text style={styles.mark}>{checked ? '☑' : '□'}</Text>
    <View style={styles.choiceText}><Text style={styles.label}>{label}</Text>{!!detail && <Text style={styles.help}>{detail}</Text>}</View>
  </Pressable>;
}

export function NotificationPreferencesScreen({draft, busy, unconfirmed, onChange, onSave, onBack}: {
  draft: NotificationPreferences; busy: boolean; unconfirmed: boolean;
  onChange: (value: NotificationPreferences) => void; onSave: () => void; onBack: () => void;
}) {
  const quietEnabled = draft.quiet_start !== null;
  return <>
    <Text style={styles.eyebrow}>CUENTA PERSONAL</Text>
    <Text style={styles.title}>Preferencias de avisos</Text>
    <Text style={styles.lead}>Elige qué avisos opcionales recibes en tu junta.</Text>
    <View style={styles.card}>
      <Choice label="Cambios de eventos" checked={draft.event_changes} busy={busy}
        onPress={() => onChange({...draft, event_changes: !draft.event_changes})} />
      <Choice label="Recordatorios de eventos" detail="24 horas y 1 hora antes, según el evento."
        checked={draft.reminders} busy={busy} onPress={() => onChange({...draft, reminders: !draft.reminders})} />
      <Choice label="Mensajes de Chat" checked={draft.chat_messages} busy={busy}
        onPress={() => onChange({...draft, chat_messages: !draft.chat_messages})} />
      <Text style={styles.help}>Las invitaciones y cancelaciones siempre llegan a la bandeja.</Text>
    </View>
    <View style={styles.card}>
      <Choice label="Horario de silencio" checked={quietEnabled} busy={busy}
        onPress={() => onChange({...draft, quiet_start: quietEnabled ? null : '22:00', quiet_end: quietEnabled ? null : '07:00'})} />
      {quietEnabled && <View style={styles.hours}>
        <View style={styles.hourField}><Text style={styles.label}>Desde (HH:mm)</Text>
          <TextInput accessibilityLabel="Silencio desde" value={draft.quiet_start ?? ''} onChangeText={value => onChange({...draft, quiet_start: value})}
            maxLength={5} placeholder="22:00" autoCorrect={false} style={styles.input} editable={!busy} /></View>
        <View style={styles.hourField}><Text style={styles.label}>Hasta (HH:mm)</Text>
          <TextInput accessibilityLabel="Silencio hasta" value={draft.quiet_end ?? ''} onChangeText={value => onChange({...draft, quiet_end: value})}
            maxLength={5} placeholder="07:00" autoCorrect={false} style={styles.input} editable={!busy} /></View>
      </View>}
      <Text style={styles.help}>El horario usa la hora de Colombia y puede cruzar medianoche. Oculta el distintivo de la campana web, pero conserva los avisos. No cambia tu presencia ni los correos de seguridad. Android aún no entrega avisos push.</Text>
    </View>
    {unconfirmed && <Text style={styles.help}>Vuelve a abrir las preferencias para consultar el estado antes de guardar otra vez.</Text>}
    <Pressable accessibilityRole="button" onPress={onSave} disabled={busy || unconfirmed} style={[styles.button, (busy || unconfirmed) && styles.disabled]}>
      <Text style={styles.buttonText}>Guardar preferencias</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onBack} disabled={busy} style={[styles.button, styles.secondary, busy && styles.disabled]}>
      <Text style={[styles.buttonText, styles.secondaryText]}>Volver a notificaciones</Text>
    </Pressable>
  </>;
}

const styles = StyleSheet.create({
  eyebrow: {color: '#087e79', fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {color: '#153139', fontSize: 32, fontWeight: '800'},
  lead: {color: '#577078', fontSize: 16, lineHeight: 23, marginBottom: 10},
  card: {backgroundColor: '#fff', padding: 18, borderRadius: 14, gap: 14, elevation: 1},
  choice: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 44},
  mark: {color: '#087e79', fontSize: 24},
  choiceText: {flex: 1, gap: 2},
  label: {color: '#153139', fontWeight: '700'},
  help: {color: '#577078', lineHeight: 20},
  hours: {flexDirection: 'row', gap: 10},
  hourField: {flex: 1, gap: 6},
  input: {borderWidth: 1, borderColor: '#cbd9d9', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: '#153139'},
  button: {backgroundColor: '#087e79', paddingVertical: 15, borderRadius: 11, alignItems: 'center', marginTop: 5},
  buttonText: {color: '#fff', fontWeight: '800', fontSize: 16},
  secondary: {backgroundColor: '#fff', borderWidth: 1, borderColor: '#087e79'},
  secondaryText: {color: '#087e79'},
  disabled: {opacity: 0.5},
});
