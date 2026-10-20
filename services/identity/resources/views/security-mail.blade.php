<!doctype html><html lang="{{ $language }}"><body style="margin:0;background:#edf1f7;font-family:Arial,sans-serif;color:#172b4d;padding:32px">
<div style="max-width:520px;margin:auto;background:white;border-radius:16px;padding:36px">
<p style="color:#245bce;font-weight:bold;letter-spacing:2px">SRD · {{ $language === 'en' ? 'SECURE ACCESS' : 'ACCESO SEGURO' }}</p>
<h1 style="font-size:26px">{{ $language === 'en' ? ($purpose === 'reset' ? 'Recover your access' : 'Confirm it is you') : ($purpose === 'reset' ? 'Recupera tu acceso' : 'Confirma que eres tú') }}</h1>
<p>{{ $language === 'en' ? ($purpose === 'email_change' ? 'Confirm this address to change your sign-in email.' : 'We received a request to access your account.') : ($purpose === 'email_change' ? 'Confirma esta dirección para cambiar tu correo de acceso.' : 'Recibimos una solicitud de acceso a tu cuenta.') }}</p>
@if($link)
<p>{{ $language === 'en' ? 'This link works once and expires in 15 minutes.' : 'Este enlace funciona una sola vez y vence en 15 minutos.' }}</p>
<p><a href="{{ $link }}" style="display:inline-block;background:#245bce;color:white;padding:16px;text-decoration:none;border-radius:8px">{{ $language === 'en' ? 'Reset password' : 'Restablecer contraseña' }}</a></p>
@else
<p>{{ $language === 'en' ? 'Enter this code in SRD. It expires in five minutes.' : 'Escribe este código en SRD. Vence en cinco minutos.' }}</p>
<p style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;background:#eef3ff;padding:22px;border-radius:10px">{{ $code }}</p>
@endif
<p style="color:#52617b;line-height:1.6">{{ $language === 'en' ? 'Do not share this message. If you did not make this request, you can ignore it and contact your council administrator.' : 'No compartas este mensaje. Si no hiciste esta solicitud, puedes ignorarla y contactar al administrador de tu junta.' }}</p>
<p style="font-size:12px;color:#52617b">{{ $language === 'en' ? 'Digital Registry System · Community security' : 'Sistema de Registro Digital · Seguridad de la comunidad' }}</p></div></body></html>
