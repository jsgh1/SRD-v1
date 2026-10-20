<!doctype html><html lang="{{ $language }}"><body style="font-family:Arial,sans-serif;padding:24px;color:#172b4d">
<h1>{{ $language === 'en' ? 'You were invited to' : 'Te invitaron a' }} {{ $organization }}</h1>
<p>{{ $language === 'en' ? 'Council code' : 'Código de junta' }}: <strong>{{ $organizationCode }}</strong></p>
<p>{{ $language === 'en' ? 'This private invitation links your account to the council. It expires 24 hours after creation and works once.' : 'Esta invitación privada permite vincular tu cuenta a la junta. Vence 24 horas después de su creación y funciona una sola vez.' }}</p>
<p><a href="{{ $link }}">{{ $language === 'en' ? 'Review and accept invitation' : 'Revisar y aceptar invitación' }}</a></p>
<p>{{ $language === 'en' ? 'If you already have an SRD account, you will need your current password. Accepting does not sign you in; access still requires a security code.' : 'Si ya tienes una cuenta en SRD, necesitarás su contraseña actual. Aceptar no inicia una sesión; el acceso sigue requiriendo el código de seguridad.' }}</p>
<p>{{ $language === 'en' ? 'If you did not expect this invitation, you can ignore it. Do not share this link.' : 'Si no esperabas esta invitación, puedes ignorarla. No compartas este enlace.' }}</p>
</body></html>
