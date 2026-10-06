import React from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {type Organization} from './api';

function Button({label, onPress, disabled, secondary = false}: {
  label: string; onPress: () => void; disabled: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

export function SwitchOrganizationScreen({current, code, target, accepted, busy, required, unconfirmed,
  onCode, onFind, onAccepted, onSwitch, onCheck, onBack, onLogout}: {
  current: Organization; code: string; target: Organization | null; accepted: boolean;
  busy: boolean; required: boolean; unconfirmed: boolean;
  onCode: (value: string) => void; onFind: () => void; onAccepted: (value: boolean) => void;
  onSwitch: () => void; onCheck: () => void; onBack: () => void; onLogout: () => void;
}) {
  return <>
    <Text style={styles.eyebrow}>CONTEXTO DE TRABAJO</Text>
    <Text style={styles.title}>{required ? 'Términos actualizados' : 'Cambiar de junta'}</Text>
    <Text style={styles.help}>{required
      ? `Los términos de ${current.name} cambiaron. Léelos y acéptalos para continuar.`
      : `Trabajas en ${current.name}. Solo puedes cambiar a una junta autorizada para tu cuenta.`}</Text>
    {!required && !unconfirmed && <View style={styles.card}>
      <Text style={styles.label}>Código de la junta destino</Text>
      <TextInput accessibilityLabel="Código de junta destino" value={code} onChangeText={onCode}
        autoCapitalize="none" autoCorrect={false} style={styles.input} editable={!busy} />
      <Button label="Cargar términos" onPress={onFind} disabled={busy} />
    </View>}
    {required && !unconfirmed && <Button label="Actualizar términos" onPress={onFind} disabled={busy} secondary />}
    {target && !unconfirmed && <View style={styles.card}>
      <Text style={styles.heading}>Términos de {target.name} · versión {target.terms.version}</Text>
      <Text style={styles.terms}>{target.terms.body}</Text>
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked: accepted, disabled: busy}}
        onPress={() => onAccepted(!accepted)} disabled={busy} style={styles.checkbox}>
        <Text style={styles.mark}>{accepted ? '☑' : '□'}</Text>
        <Text style={styles.label}>Acepto los términos vigentes de {target.name}</Text>
      </Pressable>
      <Button label={required ? 'Aceptar y continuar' : 'Aceptar y cambiar de junta'}
        onPress={onSwitch} disabled={busy || !accepted} />
    </View>}
    {unconfirmed && <View style={styles.card}>
      <Text style={styles.help}>La respuesta del cambio no llegó. Consulta la junta activa antes de hacer otra solicitud.</Text>
      <Button label="Comprobar junta activa" onPress={onCheck} disabled={busy} />
    </View>}
    {!required && !unconfirmed && <Button label="Volver al resumen" onPress={onBack} disabled={busy} secondary />}
    {required && <Button label="Cerrar sesión" onPress={onLogout} disabled={busy} secondary />}
  </>;
}

const styles = StyleSheet.create({
  eyebrow: {color: '#087e79', fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {color: '#153139', fontSize: 32, fontWeight: '800'},
  heading: {color: '#153139', fontSize: 17, fontWeight: '700'},
  help: {color: '#577078', lineHeight: 21},
  card: {backgroundColor: '#fff', padding: 18, borderRadius: 14, gap: 14, elevation: 1},
  label: {color: '#153139', fontWeight: '700'},
  input: {borderWidth: 1, borderColor: '#cbd9d9', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: '#153139'},
  terms: {color: '#153139', lineHeight: 22},
  checkbox: {flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44},
  mark: {color: '#087e79', fontSize: 24},
  button: {backgroundColor: '#087e79', paddingVertical: 15, borderRadius: 11, alignItems: 'center'},
  buttonText: {color: '#fff', fontWeight: '800', fontSize: 16},
  secondary: {backgroundColor: '#fff', borderWidth: 1, borderColor: '#087e79'},
  secondaryText: {color: '#087e79'},
  disabled: {opacity: 0.5},
});
