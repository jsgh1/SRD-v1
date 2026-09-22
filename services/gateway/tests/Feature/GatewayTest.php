<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class GatewayTest extends TestCase
{
    public function test_filter_delegation_uses_verified_caller_and_records_authorization(): void
    {
        Http::fake(fn ($r) => str_ends_with($r->url(), '/auth/me')
            ? Http::response(['data'=>['user_id'=>'trusted-user','organization_id'=>'trusted-org','role'=>'viewer','terms_required'=>false]])
            : Http::response([],403));
        $this->getJson('/api/v1/person-filter-settings')->assertUnauthorized();
        Http::assertNothingSent();
        $this->withSession(['credential'=>'opaque'])->putJson('/api/v1/person-filter-settings',[
            'version'=>0,'base'=>[],'custom'=>[],'delegated_roles'=>['viewer'],'role'=>'admin','organization_id'=>'forged',
        ])->assertForbidden();
        Http::assertSent(function ($r) {
            if (!str_ends_with($r->url(),'/person-filter-settings')) return false;
            $claims=json_decode(base64_decode(explode('.',$r->header('X-SRD-Context')[0])[0]),true);
            return $claims['aud']==='records' && $claims['context']['role']==='viewer' && $claims['context']['organization_id']==='trusted-org'
                && !isset($r['role']) && !isset($r['organization_id']) && $r['delegated_roles']===['viewer'];
        });
    }
    public function test_photos_use_verified_session_and_preserve_file_quota_errors(): void
    {
        $id = '11111111-1111-4111-8111-111111111111';
        $path = '/api/v1/persons/'.$id.'/photos/person';
        Http::fake(fn ($r) => str_ends_with($r->url(), '/auth/me')
            ? Http::response(['data' => ['user_id' => 'trusted-user', 'organization_id' => 'trusted-org', 'session_id' => 'trusted-session', 'role' => 'admin', 'terms_required' => false]])
            : Http::response([], 507));
        $this->getJson($path)->assertUnauthorized();
        Http::assertNothingSent();
        $this->withSession(['credential' => 'opaque'])->putJson($path, ['name' => 'a.png', 'content' => 'YQ==', 'version' => 0, 'role' => 'superadmin', 'organization_id' => 'forged'])->assertStatus(507);
        Http::assertSent(function ($r) {
            if (!str_contains($r->url(), '/photos/person')) return false;
            $claims = json_decode(base64_decode(explode('.', $r->header('X-SRD-Context')[0])[0]), true);
            return $claims['aud'] === 'files' && $claims['context']['role'] === 'admin' && $claims['context']['organization_id'] === 'trusted-org'
                && !isset($r['role']) && !isset($r['organization_id']) && $r['version'] === 0 && $r['content'] === 'YQ==';
        });
        $this->getJson('/api/v1/persons/'.$id.'/photos/unknown')->assertNotFound();
    }
    public function test_heartbeat_only_uses_server_credential_and_never_calls_me(): void
    {
        Http::fake(fn () => Http::response(['data' => ['effective' => 'online']]));
        $this->postJson('/api/v1/presence/heartbeat')->assertUnauthorized();
        $this->withSession(['credential' => 'server-token'])->postJson('/api/v1/presence/heartbeat', ['token' => 'forged', 'user_id' => 'forged'])->assertOk();
        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/auth/presence') && $r->data() === ['token' => 'server-token']);
    }
    public function test_contacts_always_resolve_passively_despite_browser_input(): void
    {
        Http::fake(fn ($request) => Http::response(['data' => str_ends_with($request->url(), '/auth/me')
            ? ['user_id' => 'trusted-user', 'organization_id' => 'trusted-organization', 'session_id' => 'trusted-session', 'role' => 'viewer', 'terms_required' => false]
            : ['items' => [], 'total' => 0]]));
        $this->withSession(['credential' => 'server-token'])->getJson('/api/v1/contacts?touch_activity=1&token=forged')->assertOk();
        Http::assertSentCount(2);
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/auth/me') && $r->data() === ['token' => 'server-token', 'touch_activity' => false]);
    }

    public function test_forged_browser_identity_headers_cannot_authorize(): void
    {
        Http::fake();
        $this->withHeaders(['X-Organization-ID' => 'forged', 'X-Role' => 'superadmin', 'X-SRD-Context' => 'forged'])->getJson('/api/v1/persons')->assertUnauthorized();
        Http::assertNothingSent();
    }

    public function test_public_signup_and_unimplemented_routes_are_not_exposed(): void
    {
        $this->postJson('/api/v1/register')->assertNotFound();
        $this->postJson('/api/v1/auth/signup')->assertNotFound();
    }

    public function test_browsing_does_not_consume_auth_limit_but_auth_requests_do(): void
    {
        for ($i = 0; $i < 25; $i++) $this->getJson('/api/v1/csrf')->assertOk();
        for ($i = 0; $i < 20; $i++) $this->postJson('/api/v1/auth/logout')->assertUnauthorized();
        $this->postJson('/api/v1/auth/logout')->assertTooManyRequests();
        $this->getJson('/api/v1/csrf')->assertOk();
        $this->postJson('/api/v1/profile/email-change', [])->assertUnauthorized();
    }

    public function test_target_membership_role_does_not_replace_signed_caller_role(): void
    {
        Http::fake(fn ($request) => Http::response(['data' => str_ends_with($request->url(), '/auth/me')
            ? ['user_id' => 'trusted-user', 'organization_id' => 'trusted-organization', 'session_id' => 'trusted-session', 'role' => 'admin', 'terms_required' => false]
            : ['id' => 'synthetic-invitation']]));
        $this->withSession(['credential' => 'opaque-server-credential'])->postJson('/api/v1/invitations', ['email' => 'nuevo@example.test', 'role' => 'viewer', 'organization_id' => 'forged', 'user_id' => 'forged'])->assertOk();
        Http::assertSent(function ($request) {
            if (!str_ends_with($request->url(), '/invitations')) return false;
            $encoded = explode('.', $request->header('X-SRD-Context')[0])[0];
            $context = json_decode(base64_decode($encoded), true)['context'];
            return $request['role'] === 'viewer' && !isset($request['organization_id']) && !isset($request['user_id'])
                && $context['role'] === 'admin' && $context['organization_id'] === 'trusted-organization';
        });
    }
}
