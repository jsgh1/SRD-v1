<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Srd\InternalClient;

final class GatewayController
{
    public function __construct(private InternalClient $client) {}

    private function principal(Request $r, bool $allowTerms = false, bool $touchActivity = true): array
    {
        abort_unless($r->session()->has('credential'), 401);
        $p = $this->client->call('identity', 'POST', 'auth/me', ['token' => $r->session()->get('credential'), 'touch_activity' => $touchActivity]);
        abort_unless($allowTerms || ! $p['terms_required'], 403);

        return $p;
    }

    public function publicConfig(string $code): array
    {
        abort_unless(preg_match('/^[a-z0-9-]{3,40}$/', $code), 404);

        return ['data' => $this->client->call('configuration', 'GET', 'organizations/code/'.$code)];
    }

    public function auth(Request $r, string $action): array
    {
        abort_unless(in_array($action, ['login', 'verify', 'resend', 'cancel', 'recover', 'reset', 'logout', 'revokeOthers', 'switchOrganization'], true), 404);
        $data = $r->except(['token', 'organization_id', 'role', 'principal']);
        if (in_array($action, ['logout', 'revokeOthers', 'switchOrganization'], true)) {
            $this->principal($r, true);
            $data['token'] = $r->session()->get('credential');
        }
        if (in_array($action, ['verify', 'resend', 'cancel'], true)) {
            abort_unless($r->session()->get('challenge_id') === ($data['challenge_id'] ?? null), 422);
        }
        $result = $this->client->call('identity', 'POST', 'auth/'.$action, $data);
        if (in_array($action, ['login', 'resend'], true)) {
            $r->session()->put('challenge_id', $result['challenge_id']);
        }
        if ($action === 'verify') {
            $r->session()->regenerate();
            $r->session()->put('credential', $result['token']);
            $r->session()->forget('challenge_id');

            return ['data' => $this->principal($r)];
        }
        if ($action === 'cancel') {
            $r->session()->forget('challenge_id');
        }
        if ($action === 'logout') {
            $r->session()->invalidate();
            $r->session()->regenerateToken();
        }

        return ['data' => $result];
    }

    public function me(Request $r): array
    {
        return ['data' => $this->principal($r, true)];
    }

    public function presence(Request $r): array
    {
        abort_unless($r->session()->has('credential'), 401);
        // Do not call principal(): automatic traffic must not renew idle time.
        return ['data' => $this->client->call('identity', 'POST', 'auth/presence', ['token' => $r->session()->get('credential')])];
    }

    public function invitation(Request $r, string $action): array
    {
        abort_unless(in_array($action, ['inspect', 'accept'], true), 404);

        return ['data' => $this->client->call('identity', 'POST', 'invitations/'.$action,
            $r->only(['invitation_id', 'secret', 'name', 'password', 'password_confirmation', 'terms_version_id', 'accepted']))];
    }

    public function forward(Request $r, string $service, string $path): array
    {
        $p = $this->principal($r, false, !($service === 'identity' && $path === 'contacts' && $r->isMethod('GET')));
        $context = array_intersect_key($p, array_flip(['user_id', 'organization_id', 'session_id', 'role']));
        $data = $r->except(['organization_id', 'user_id', 'role', 'principal', 'token']);
        // This is the target membership's role, never the caller's authority.
        if ($service === 'identity' && (($path === 'invitations' && $r->isMethod('POST')) || (str_starts_with($path, 'members/') && $r->isMethod('PATCH')))) {
            $data['role'] = $r->input('role');
        }

        return ['data' => $this->client->call($service, $r->method(), $path, $data, $context)];
    }
}
