<!doctype html><html lang="es"><body style="margin:0;background:#edf1f7;font-family:Arial,sans-serif;color:#172b4d;padding:32px">
<div style="max-width:520px;margin:auto;background:white;border-radius:16px;padding:36px">
<p style="color:#245bce;font-weight:bold;letter-spacing:2px">SRD · ACCESO SEGURO</p>
<h1 style="font-size:26px">{{ $purpose === 'reset' ? 'Recupera tu acceso' : 'Confirma que eres tú' }}</h1>
<p>{{ $purpose === 'email_change' ? 'Confirma esta dirección para cambiar tu correo de acceso.' : 'Recibimos una solicitud de acceso a tu cuenta.' }}</p>
@if($link)<p>Este enlace funciona una sola vez y vence en 15 minutos.</p><p><a href="{{ $link }}" style="display:inline-block;background:#245bce;color:white;padding:16px;text-decoration:none;border-radius:8px">Restablecer contraseña</a></p>
@else<p>Escribe este código en SRD. Vence en cinco minutos.</p><p style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;background:#eef3ff;padding:22px;border-radius:10px">{{ $code }}</p>@endif
<p style="color:#52617b;line-height:1.6">No compartas este mensaje. Si no hiciste esta solicitud, puedes ignorarla y contactar al administrador de tu junta.</p>
<p style="font-size:12px;color:#52617b">Sistema de Registro Digital · Seguridad de la comunidad</p></div></body></html>
