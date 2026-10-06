import React from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {type Principal} from './api';

const presenceOptions: Array<{value: Principal['user']['presence']; label: string; help: string}> = [
  {value: 'online', label: 'En línea', help: 'Otros integrantes pueden ver tu disponibilidad.'},
  {value: 'away', label: 'Ausente', help: 'Indica que no estás disponible por ahora.'},
  {value: 'dnd', label: 'No molestar', help: 'Oculta el distintivo web de avisos; los avisos se conservan.'},
  {value: 'invisible', label: 'Invisible', help: 'Apareces desconectado para otros integrantes.'},
];

export function ProfileScreen({principal, name, presence, busy, onName, onPresence, onSave, onBack}: {
  principal: Principal; name: string; presence: Principal['user']['presence']; busy: boolean;
  onName: (name: string) => void; onPresence: (value: Principal['user']['presence']) => void;
  onSave: () => void; onBack: () => void;
}) {
  return <>
    <Text style={styles.eyebrow}>CUENTA PERSONAL</Text>
    <Text style={styles.title}>Mi perfil</Text>
    <Text style={styles.lead}>Actualiza tu nombre y cómo apareces ante tu junta.</Text>
    <View style={styles.card}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput accessibilityLabel="Nombre" value={name} onChangeText={onName} maxLength={120}
        autoCapitalize="words" style={styles.input} editable={!busy} />
      <Text style={styles.label}>Correo de acceso</Text>
      <Text style={styles.value}>{principal.user.email}</Text>
      <Text style={styles.help}>El cambio de correo se gestiona desde la web o Windows.</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.label}>Preferencia de presencia</Text>
      {presenceOptions.map(option => <Pressable key={option.value} accessibilityRole="radio"
        accessibilityState={{selected: presence === option.value, disabled: busy}}
        onPress={() => onPresence(option.value)} disabled={busy}
        style={[styles.choice, presence === option.value && styles.choiceSelected]}>
        <Text style={styles.choiceLabel}>{option.label}</Text>
        <Text style={styles.help}>{option.help}</Text>
      </Pressable>)}
      <Text style={styles.help}>La presencia efectiva también depende de la conexión activa.</Text>
    </View>
    <Pressable accessibilityRole="button" onPress={onSave} disabled={busy} style={[styles.button, busy && styles.disabled]}>
      <Text style={styles.buttonText}>Guardar perfil</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onBack} disabled={busy} style={[styles.button, styles.secondary, busy && styles.disabled]}>
      <Text style={[styles.buttonText, styles.secondaryText]}>Volver al resumen</Text>
    </Pressable>
  </>;
}

const styles = StyleSheet.create({
  eyebrow: {color: '#087e79', fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {color: '#153139', fontSize: 32, fontWeight: '800'},
  lead: {color: '#577078', fontSize: 16, lineHeight: 23, marginBottom: 10},
  card: {backgroundColor: '#fff', padding: 20, borderRadius: 20, gap: 12, elevation: 2},
  label: {color: '#153139', fontWeight: '700'},
  input: {borderWidth: 1, borderColor: '#cbd9d9', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11, color: '#153139'},
  value: {color: '#153139', fontSize: 16},
  help: {color: '#577078', lineHeight: 20},
  choice: {borderWidth: 1, borderColor: '#cbd9d9', borderRadius: 11, padding: 12, gap: 3},
  choiceSelected: {borderColor: '#087e79', backgroundColor: '#eaf6f4'},
  choiceLabel: {color: '#153139', fontWeight: '700'},
  button: {backgroundColor: '#087e79', paddingVertical: 15, borderRadius: 11, alignItems: 'center', marginTop: 5},
  buttonText: {color: '#fff', fontWeight: '800', fontSize: 16},
  secondary: {backgroundColor: '#fff', borderWidth: 1, borderColor: '#087e79'},
  secondaryText: {color: '#087e79'},
  disabled: {opacity: 0.5},
});
