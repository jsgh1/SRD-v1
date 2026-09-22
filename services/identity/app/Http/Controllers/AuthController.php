<?php

namespace App\Http\Controllers;

use App\Application\ChallengeService;
use App\Application\SessionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Srd\DependencyFailure;
use Srd\InternalClient;
use Srd\Outbox;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

final class AuthController
{
    public function __construct(private ChallengeService $challenges, private SessionService $sessions) {}

    private function finish(array $data): array
    {
        if ($data['delivery_failed'] ?? false) {
            throw new DependencyFailure;
        }

return ['data' => $data];
    }

    public function login(Request $r): array
    {
        $d = $r->validate(['email' => 'required|email|max:254', 'password' => 'required|string|max:1024', 'organization_code' => 'required|regex:/^[a-z0-9-]{3,40}$/', 'terms_version_id' => 'required|uuid', 'accepted' => 'required|accepted']);
        $key = 'login:'.hash('sha256', strtolower($d['email']));
        abort_if(RateLimiter::tooManyAttempts($key, 10), 429);
        RateLimiter::hit($key, 300);
        $org = app(InternalClient::class)->call('configuration', 'GET', 'organizations/code/'.$d['organization_code']);
        abort_unless($org['terms']['id'] === $d['terms_version_id'], 409);
        $result = DB::transaction(function () use ($d, $org) {
            $user = DB::table('users')->where('email', strtolower($d['email']))->lockForUpdate()->first();
            if (! $user || ! Hash::check($d['password'], $user->password) || ! $this->sessions->role($user, $org['id'])) {
                Outbox::record('auth.login_rejected', $org['id'], null, null, 'rejected');

                return ['invalid' => true];
            }

            return $this->challenges->issue($user, $org['id'], 'login', $user->email, $d['terms_version_id']);
        });
        abort_if($result['invalid'] ?? false, 401);

        return $this->finish($result);
    }

    public function verify(Request $r): array
    {
        $d = $r->validate(['challenge_id' => 'required|uuid', 'code' => 'required|digits:6']);
        $result = DB::transaction(function () use ($d) {
            $c = $this->challenges->consume($d['challenge_id'], 'login', $d['code']);
            if (! $c) {
                return null;
            }
            $user = DB::table('users')->where('id', $c->user_id)->lockForUpdate()->first();
            if (! $user || ! $this->sessions->role($user, $c->organization_id)) {
                return null;
            }
            $org = $this->sessions->organization($c->organization_id);
            if ($org['terms']['id'] !== $c->terms_version_id) {
                return null;
            }

            return $this->sessions->create($user, $c->organization_id, $c->terms_version_id);
        });
        abort_unless($result, 422);

        return ['data' => $result];
    }

    public function resend(Request $r): array
    {
        $d = $r->validate(['challenge_id' => 'required|uuid']);
        $result = DB::transaction(function () use ($d) {
            $c = DB::table('auth_challenges')->where('id', $d['challenge_id'])->first();
            abort_unless($c && ! $c->consumed_at && $c->purpose === 'login', 422);
            $user = DB::table('users')->where('id', $c->user_id)->lockForUpdate()->first();
            // Re-read after the user lock to prevent two resends using the same challenge.
            $c = DB::table('auth_challenges')->where('id', $c->id)->first();
            abort_if($c->consumed_at, 422);
            abort_unless($this->sessions->role($user, $c->organization_id), 401);
            $org = $this->sessions->organization($c->organization_id);
            abort_unless($org['terms']['id'] === $c->terms_version_id, 409);

            return $this->challenges->issue($user, $c->organization_id, 'login', $c->destination, $c->terms_version_id);
        });

        return $this->finish($result);
    }

    public function cancel(Request $r): array
    {
        $d = $r->validate(['challenge_id' => 'required|uuid']);
        DB::table('auth_challenges')->where('id', $d['challenge_id'])->where('purpose', 'login')->whereNull('consumed_at')->update(['consumed_at' => now()]);

        return ['data' => []];
    }

    public function me(Request $r): array
    {
        $d = $r->validate(['touch_activity' => 'sometimes|boolean']);
        return ['data' => $this->sessions->resolve($r->string('token')->toString(), true, (bool) ($d['touch_activity'] ?? true))];
    }

    public function logout(Request $r): array
    {
        $p = $this->sessions->resolve($r->string('token')->toString(), true);
        DB::transaction(function () use ($p) {
            DB::table('auth_sessions')->where('id', $p['session_id'])->update(['revoked_at' => now()]);
            Outbox::record('auth.logout', $p['organization_id'], $p['user_id'], $p['session_id']);
        });

        return ['data' => []];
    }

    public function revokeOthers(Request $r): array
    {
        $p = $this->sessions->resolve($r->string('token')->toString());
        DB::transaction(function () use ($p) {
            DB::table('auth_sessions')->where('user_id', $p['user_id'])->where('id', '!=', $p['session_id'])->whereNull('revoked_at')->update(['revoked_at' => now()]);
            Outbox::record('auth.sessions_revoked', $p['organization_id'], $p['user_id'], $p['session_id']);
        });

        return ['data' => []];
    }

    public function switchOrganization(Request $r): array
    {
        $d = $r->validate(['token' => 'required|string', 'organization_code' => 'required|regex:/^[a-z0-9-]{3,40}$/', 'accepted' => 'required|accepted', 'terms_version_id' => 'required|uuid']);
        $p = $this->sessions->resolve($d['token'], true);
        $org = app(InternalClient::class)->call('configuration', 'GET', 'organizations/code/'.$d['organization_code']);

        return DB::transaction(function () use ($d, $p, $org) {
            $u = DB::table('users')->where('id', $p['user_id'])->lockForUpdate()->first();
            abort_unless($this->sessions->role($u, $org['id']), 403);
            abort_unless($org['terms']['id'] === $d['terms_version_id'], 409);
            DB::table('terms_acceptances')->insertOrIgnore(['user_id' => $u->id, 'organization_id' => $org['id'], 'terms_version_id' => $d['terms_version_id'], 'accepted_at' => now()]);
            DB::table('auth_sessions')->where('id', $p['session_id'])->update(['organization_id' => $org['id']]);
            Outbox::record('auth.organization_selected', $org['id'], $u->id, $p['session_id']);

            return ['data' => []];
        });
    }

    public function recover(Request $r): array
    {
        $d = $r->validate(['email' => 'required|email|max:254', 'organization_code' => 'required|regex:/^[a-z0-9-]{3,40}$/']);
        $key = 'reset:'.hash('sha256', strtolower($d['email']));
        if (! RateLimiter::tooManyAttempts($key, 5)) {
            RateLimiter::hit($key, 3600);
            try {
                $org = app(InternalClient::class)->call('configuration', 'GET', 'organizations/code/'.$d['organization_code']);
                DB::transaction(function () use ($d, $org) {
                    $u = DB::table('users')->where('email', strtolower($d['email']))->lockForUpdate()->first();
                    if ($u && $this->sessions->role($u, $org['id'])) {
                        $this->challenges->issue($u, $org['id'], 'reset', $u->email);
                    }
                });
            } catch (HttpExceptionInterface) { /* Same response, including throttled/unknown accounts. */
            }
        }

        return ['data' => ['message' => 'Si la cuenta está habilitada, recibirás instrucciones para recuperar el acceso.']];
    }

    public function reset(Request $r): array
    {
        $d = $r->validate(['challenge_id' => 'required|uuid', 'secret' => 'required|string|size:64', 'password' => 'required|string|min:12|max:128|confirmed']);
        $ok = DB::transaction(function () use ($d) {
            $c = $this->challenges->consume($d['challenge_id'], 'reset', $d['secret']);
            if (! $c) {
                return false;
            }
            $u = DB::table('users')->where('id', $c->user_id)->lockForUpdate()->first();
            if (! $u->active) {
                return false;
            }
            DB::table('users')->where('id', $u->id)->update(['password' => Hash::make($d['password']), 'updated_at' => now()]);
            DB::table('auth_sessions')->where('user_id', $u->id)->update(['revoked_at' => now()]);
            DB::table('auth_challenges')->where('user_id',$u->id)->whereNull('consumed_at')->update(['consumed_at' => now()]);
            Outbox::record('auth.password_reset',$c->organization_id,$u->id,$u->id);

            return true;
        });
        abort_unless($ok,422);

        return ['data' => []];
    }
}
