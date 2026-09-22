<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Srd\Testing\SignedRequests;
use Tests\TestCase;

final class AuthenticationTest extends TestCase
{
    use RefreshDatabase,SignedRequests;

    private string $org = '11111111-1111-4111-8111-111111111111';

    private string $terms = '22222222-2222-4222-8222-222222222222';

    private string $user = '33333333-3333-4333-8333-333333333333';

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('users')->insert(['id' => $this->user, 'name' => 'Cuenta de prueba', 'email' => 'operador@example.test', 'password' => Hash::make('Clave-de-prueba-123'), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('memberships')->insert(['id' => '44444444-4444-4444-8444-444444444444', 'user_id' => $this->user, 'organization_id' => $this->org, 'role' => 'registrar']);
        Http::fake(fn ($request) => Http::response(['data' => ['id' => str_ends_with($request->url(), '/code/otra') ? '55555555-5555-4555-8555-555555555555' : $this->org, 'code' => 'prueba', 'name' => 'Junta de prueba', 'terms' => ['id' => $this->terms, 'version' => 1, 'body' => 'Términos ficticios para pruebas automatizadas.']]]));
    }

    private function login(): array
    {
        $r = $this->internal('POST', 'auth/login', ['email' => 'operador@example.test', 'password' => 'Clave-de-prueba-123', 'organization_code' => 'prueba', 'terms_version_id' => $this->terms, 'accepted' => true]);
        $r->assertOk();
        $r->assertJsonMissingPath('data.token');
        $message = Mail::getSymfonyTransport()->messages()->last()->getOriginalMessage();
        preg_match('/>\s*(\d{6})\s*</', $message->getHtmlBody(), $matches);
        $this->assertNotEmpty($matches, 'Email includes a six-digit code');

        return [$r->json('data.challenge_id'), $matches[1]];
    }

    public function test_passive_principal_checks_do_not_extend_idle_session(): void
    {
        $sessions = app(\App\Application\SessionService::class);
        $token = $sessions->create(DB::table('users')->where('id', $this->user)->first(), $this->org, $this->terms)['token'];
        $activity = DB::table('auth_sessions')->value('last_activity_at');
        $this->travel(20)->minutes();
        $this->internal('POST', 'auth/me', ['token' => $token, 'touch_activity' => false])->assertOk();
        $this->assertSame($activity, DB::table('auth_sessions')->value('last_activity_at'));
        $this->travel(10)->minutes();
        $this->internal('POST', 'auth/me', ['token' => $token, 'touch_activity' => false])->assertUnauthorized();
        $this->assertSame($activity, DB::table('auth_sessions')->value('last_activity_at'));
    }

    public function test_presence_expires_without_renewing_idle_time_and_masks_invisible(): void
    {
        $sessions = app(\App\Application\SessionService::class);
        $presence = app(\App\Application\PresenceService::class);
        $user = DB::table('users')->where('id', $this->user)->first();
        $token = $sessions->create($user, $this->org, $this->terms)['token'];
        $activity = DB::table('auth_sessions')->value('last_activity_at');
        $this->assertSame('offline', $presence->effective($this->user));
        $this->internal('POST', 'auth/presence', ['token' => $token])->assertOk()->assertJsonPath('data.effective', 'online');
        $this->travel(89)->seconds();
        $this->assertSame('online', $presence->effective($this->user));
        $this->travel(1)->seconds();
        $this->assertSame('offline', $presence->effective($this->user));
        foreach (['away', 'dnd', 'invisible'] as $preference) {
            DB::table('users')->where('id', $this->user)->update(['presence' => $preference]);
            $this->internal('POST', 'auth/presence', ['token' => $token])->assertOk()->assertJsonPath('data.effective', $preference === 'invisible' ? 'offline' : $preference);
        }
        $this->assertSame($activity, DB::table('auth_sessions')->value('last_activity_at'));
        $this->travel(29)->minutes();
        $this->internal('POST', 'auth/presence', ['token' => $token])->assertUnauthorized();
        $this->assertSame($activity, DB::table('auth_sessions')->value('last_activity_at'));
    }

    public function test_presence_combines_sessions_and_revocation_removes_connection(): void
    {
        $sessions = app(\App\Application\SessionService::class);
        $presence = app(\App\Application\PresenceService::class);
        $user = DB::table('users')->where('id', $this->user)->first();
        $first = $sessions->create($user, $this->org, $this->terms)['token'];
        $second = $sessions->create($user, $this->org, $this->terms)['token'];
        $this->internal('POST', 'auth/presence', ['token' => $first])->assertOk();
        $this->travel(60)->seconds();
        $this->internal('POST', 'auth/presence', ['token' => $second])->assertOk();
        $this->travel(31)->seconds();
        $this->assertSame('online', $presence->effective($this->user));
        $this->internal('POST', 'auth/logout', ['token' => $second])->assertOk();
        $this->assertSame('offline', $presence->effective($this->user));
        $this->internal('POST', 'auth/presence', ['token' => $second])->assertUnauthorized();
        $this->internal('POST', 'auth/presence', ['token' => $first])->assertOk();
        DB::table('users')->where('id', $this->user)->update(['active' => false]);
        $this->assertSame('offline', $presence->effective($this->user));
        $this->internal('POST', 'auth/presence', ['token' => $first])->assertUnauthorized();
    }

    public function test_login_requires_terms_and_internal_signature(): void
    {
        $this->postJson('/internal/v1/auth/login', [])->assertUnauthorized();
        $this->internal('POST', 'auth/login', ['email' => 'operador@example.test', 'password' => 'Clave-de-prueba-123', 'organization_code' => 'prueba', 'terms_version_id' => $this->terms, 'accepted' => false])->assertUnprocessable();
        $this->assertDatabaseCount('auth_sessions', 0);
    }

    public function test_code_creates_one_session_and_cannot_be_reused(): void
    {
        [$id,$code] = $this->login();
        $this->assertDatabaseCount('auth_sessions', 0);
        $stored = DB::table('auth_challenges')->first();
        $this->assertNotEquals($code, $stored->digest);
        $response = $this->internal('POST', 'auth/verify', ['challenge_id' => $id, 'code' => $code])->assertOk();
        $token = $response->json('data.token');
        $this->assertDatabaseCount('auth_sessions', 1);
        $this->assertNotEquals($token, DB::table('auth_sessions')->first()->token_hash);
        $this->internal('POST', 'auth/verify', ['challenge_id' => $id, 'code' => $code])->assertUnprocessable();
        $this->internal('POST', 'auth/me', ['token' => $token])->assertOk()->assertJsonPath('data.organization_id', $this->org)->assertJsonPath('data.role', 'registrar');
        $this->internal('POST', 'auth/logout', ['token' => $token])->assertOk();
        $this->internal('POST', 'auth/me', ['token' => $token])->assertUnauthorized();
    }

    public function test_five_wrong_attempts_lock_the_challenge_and_are_durable(): void
    {
        [$id,$code] = $this->login();
        $bad = $code === '000000' ? '999999' : '000000';
        for ($i = 0; $i < 5; $i++) {
            $this->internal('POST', 'auth/verify', ['challenge_id' => $id, 'code' => $bad])->assertUnprocessable();
        }
        $this->assertSame(5, DB::table('auth_challenges')->where('id', $id)->value('attempts'));
        $this->internal('POST', 'auth/verify', ['challenge_id' => $id, 'code' => $code])->assertUnprocessable();
        $this->assertDatabaseCount('auth_sessions', 0);
    }

    public function test_expired_code_is_rejected(): void
    {
        [$id,$code] = $this->login();
        $this->travel(6)->minutes();
        $this->internal('POST', 'auth/verify', ['challenge_id' => $id, 'code' => $code])->assertUnprocessable();
    }

    public function test_resend_wait_and_old_code_invalidation(): void
    {
        [$id,$code] = $this->login();
        $this->internal('POST', 'auth/resend', ['challenge_id' => $id])->assertTooManyRequests();
        $this->travel(61)->seconds();
        $r = $this->internal('POST', 'auth/resend', ['challenge_id' => $id])->assertOk();
        $this->assertNotEquals($id, $r->json('data.challenge_id'));
        $this->internal('POST', 'auth/verify', ['challenge_id' => $id, 'code' => $code])->assertUnprocessable();
    }

    public function test_sixth_hourly_send_is_rejected(): void
    {
        [$id] = $this->login();
        for ($i = 1; $i < 5; $i++) {
            $this->travel(61)->seconds();
            $id = $this->internal('POST', 'auth/resend', ['challenge_id' => $id])->assertOk()->json('data.challenge_id');
        }
        $this->travel(61)->seconds();
        $this->internal('POST', 'auth/resend', ['challenge_id' => $id])->assertTooManyRequests();
    }

    public function test_membership_revocation_and_idle_session_fail_closed(): void
    {
        [$id,$code] = $this->login();
        $token = $this->internal('POST', 'auth/verify', ['challenge_id' => $id, 'code' => $code])->json('data.token');
        DB::table('memberships')->update(['active' => false]);
        $this->internal('POST', 'auth/me', ['token' => $token])->assertUnauthorized();
        DB::table('memberships')->update(['active' => true]);
        $this->travel(31)->minutes();
        $this->internal('POST', 'auth/me', ['token' => $token])->assertUnauthorized();
    }

    public function test_cannot_switch_to_unrelated_organization(): void
    {
        [$id,$code] = $this->login();
        $token = $this->internal('POST', 'auth/verify', ['challenge_id' => $id, 'code' => $code])->json('data.token');
        $this->internal('POST', 'auth/switchOrganization', ['token' => $token, 'organization_code' => 'otra', 'accepted' => true, 'terms_version_id' => $this->terms])->assertForbidden();
    }

    public function test_recovery_is_generic_and_reset_revokes_sessions(): void
    {
        [$id,$code] = $this->login();
        $token = $this->internal('POST', 'auth/verify', ['challenge_id' => $id, 'code' => $code])->json('data.token');
        $a = $this->internal('POST', 'auth/recover', ['email' => 'operador@example.test', 'organization_code' => 'prueba'])->assertOk()->json('data');
        $message = Mail::getSymfonyTransport()->messages()->last()->getOriginalMessage()->getHtmlBody();
        preg_match('/\/reset#([a-f0-9-]+)\.([a-f0-9]{64})/', $message, $m);
        $this->assertCount(3, $m);
        $b = $this->internal('POST', 'auth/recover', ['email' => 'inexistente@example.test', 'organization_code' => 'prueba'])->assertOk()->json('data');
        $this->assertEquals($a, $b);
        $this->internal('POST', 'auth/verify', ['challenge_id' => $m[1], 'code' => '123456'])->assertUnprocessable();
        $payload = ['challenge_id' => $m[1], 'secret' => $m[2], 'password' => 'Nueva-clave-segura-123', 'password_confirmation' => 'Nueva-clave-segura-123'];
        $this->internal('POST', 'auth/reset', $payload)->assertOk();
        $this->internal('POST', 'auth/reset', $payload)->assertUnprocessable();
        $this->internal('POST', 'auth/me', ['token' => $token])->assertUnauthorized();
        $this->assertTrue(Hash::check($payload['password'], DB::table('users')->value('password')));
    }

    public function test_smtp_failure_never_reports_sent_or_creates_session(): void
    {
        Mail::shouldReceive('send')->andThrow(new \RuntimeException('SMTP unavailable'));
        $this->internal('POST', 'auth/login', ['email' => 'operador@example.test', 'password' => 'Clave-de-prueba-123', 'organization_code' => 'prueba', 'terms_version_id' => $this->terms, 'accepted' => true])->assertStatus(503);
        $this->assertDatabaseCount('auth_sessions', 0);
        $this->assertNotNull(DB::table('auth_challenges')->value('consumed_at'));
        $this->assertDatabaseHas('outbox_events', ['action' => 'auth.delivery_failed']);
    }

    public function test_email_change_requires_password_and_code_then_revokes_other_sessions_and_notifies_old_address(): void
    {
        [$id, $code] = $this->login();
        $token = $this->internal('POST', 'auth/verify', ['challenge_id' => $id, 'code' => $code])->json('data.token');
        $principal = ['user_id' => $this->user, 'organization_id' => $this->org, 'role' => 'registrar', 'session_id' => DB::table('auth_sessions')->value('id')];
        $this->travel(61)->seconds();
        [$otherId, $otherCode] = $this->login();
        $otherToken = $this->internal('POST', 'auth/verify', ['challenge_id' => $otherId, 'code' => $otherCode])->json('data.token');
        $body = ['new_email' => 'nuevo@example.test', 'password' => 'incorrecta'];
        $this->internal('POST', 'profile/email-change', $body, $principal)->assertUnauthorized();
        $body['password'] = 'Clave-de-prueba-123';
        $changeId = $this->internal('POST', 'profile/email-change', $body, $principal)->assertOk()->json('data.challenge_id');
        preg_match('/>\s*(\d{6})\s*</', Mail::getSymfonyTransport()->messages()->last()->getOriginalMessage()->getHtmlBody(), $m);
        $this->assertDatabaseHas('users', ['id' => $this->user, 'email' => 'operador@example.test']);
        $this->internal('POST', 'auth/verify', ['challenge_id' => $changeId, 'code' => $m[1]])->assertUnprocessable();
        $this->internal('POST', 'profile/email-change/confirm', ['challenge_id' => $changeId, 'code' => $m[1] === '000000' ? '999999' : '000000'], $principal)->assertUnprocessable();
        $this->assertDatabaseHas('users', ['id' => $this->user, 'email' => 'operador@example.test']);
        $this->internal('POST', 'profile/email-change/confirm', ['challenge_id' => $changeId, 'code' => $m[1]], $principal)->assertOk();
        $this->assertDatabaseHas('users', ['id' => $this->user, 'email' => 'nuevo@example.test']);
        $this->internal('POST', 'auth/me', ['token' => $token])->assertOk();
        $this->internal('POST', 'auth/me', ['token' => $otherToken])->assertUnauthorized();
        $this->internal('POST', 'profile/email-change/confirm', ['challenge_id' => $changeId, 'code' => $m[1]], $principal)->assertUnprocessable();
        $notice = DB::table('security_notices')->first();
        $this->assertNotEquals('operador@example.test', $notice->destination_encrypted);
        $this->artisan('srd:security-notices')->assertExitCode(0);
        $message = Mail::getSymfonyTransport()->messages()->last()->getOriginalMessage();
        $this->assertSame('operador@example.test', $message->getTo()[0]->getAddress());
        $this->assertNotNull(DB::table('security_notices')->value('sent_at'));
        $this->assertNull(DB::table('security_notices')->value('destination_encrypted'));
    }

    public function test_security_notice_failures_obey_retry_limit_and_do_not_report_delivery(): void
    {
        DB::table('security_notices')->insert(['id' => $this->terms, 'organization_id' => $this->org, 'user_id' => $this->user, 'destination_encrypted' => \Illuminate\Support\Facades\Crypt::encryptString('anterior@example.test'), 'kind' => 'email_changed', 'next_attempt_at' => now(), 'created_at' => now()]);
        Mail::shouldReceive('send')->times(4)->andThrow(new \RuntimeException('Synthetic unavailable SMTP'));
        foreach ([0, 1, 5, 15] as $minutes) {
            $this->travel($minutes)->minutes();
            $this->artisan('srd:security-notices')->assertExitCode(0);
            $this->artisan('srd:security-notices')->assertExitCode(0);
        }
        $this->travel(1)->hours();
        $this->artisan('srd:security-notices')->assertExitCode(0);
        $this->assertSame(4, DB::table('security_notices')->value('attempts'));
        $this->assertNull(DB::table('security_notices')->value('sent_at'));
        $this->assertNotNull(DB::table('security_notices')->value('destination_encrypted'));
        $this->assertDatabaseMissing('outbox_events', ['action' => 'profile.email_notice_sent']);
    }

    public function test_email_resend_requires_recent_reauthentication_and_rejects_existing_email(): void
    {
        [$id, $code] = $this->login();
        $this->internal('POST', 'auth/verify', ['challenge_id' => $id, 'code' => $code])->assertOk();
        $principal = ['user_id' => $this->user, 'organization_id' => $this->org, 'role' => 'registrar', 'session_id' => DB::table('auth_sessions')->value('id')];
        $this->internal('POST', 'profile/email-change', ['new_email' => 'operador@example.test', 'password' => 'Clave-de-prueba-123'], $principal)->assertUnprocessable();
        $changeId = $this->internal('POST', 'profile/email-change', ['new_email' => 'nuevo@example.test', 'password' => 'Clave-de-prueba-123'], $principal)->assertOk()->json('data.challenge_id');
        $this->internal('POST', 'profile/email-change/resend', ['challenge_id' => $changeId], $principal)->assertTooManyRequests();
        $this->travel(61)->seconds();
        $newId = $this->internal('POST', 'profile/email-change/resend', ['challenge_id' => $changeId], $principal)->assertOk()->json('data.challenge_id');
        $this->assertNotSame($changeId, $newId);
        $this->travel(5)->minutes();
        $this->internal('POST', 'profile/email-change/resend', ['challenge_id' => $newId], $principal)->assertUnauthorized();
        $this->assertDatabaseHas('users', ['id' => $this->user, 'email' => 'operador@example.test']);
    }
}
