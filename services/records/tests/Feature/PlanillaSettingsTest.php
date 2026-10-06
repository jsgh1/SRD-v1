<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Srd\Access;
use Srd\Testing\SignedRequests;
use Tests\TestCase;

final class PlanillaSettingsTest extends TestCase
{
    use RefreshDatabase, SignedRequests;

    private array $admin = [
        'organization_id' => '11111111-1111-4111-8111-111111111111',
        'user_id' => '22222222-2222-4222-8222-222222222222', 'role' => 'admin',
    ];

    private function data(int $version = 0): array
    {
        return ['version' => $version, 'allowed_columns' => ['zone', 'phone'],
            'h1' => 'JUNTA COMUNAL', 'h2' => 'Sector norte', 'h3' => 'ASISTENCIA'];
    }

    public function test_settings_are_scoped_validated_and_versioned(): void
    {
        foreach (Access::ROLES as $role) {
            $p = array_replace($this->admin, ['role' => $role]);
            $this->internal('GET', 'planilla-settings', [], $p)->assertOk()
                ->assertJsonPath('data.version', 0)->assertJsonCount(8, 'data.allowed_columns')
                ->assertJsonPath('data.can_manage', in_array($role, ['admin', 'superadmin']));
            if (!in_array($role, ['admin', 'superadmin'])) {
                $this->internal('PUT', 'planilla-settings', $this->data(), $p)->assertForbidden();
            }
        }
        $this->assertDatabaseCount('planilla_settings', 0);
        foreach ([
            ['allowed_columns' => ['note']], ['allowed_columns' => ['zone', 'zone']],
            ['h1' => ''], ['h2' => str_repeat('a', 121)],
            ['delegated_roles' => ['superadmin']], ['delegated_roles' => ['viewer', 'viewer']],
        ] as $invalid) {
            $this->internal('PUT', 'planilla-settings', array_replace($this->data(), $invalid), $this->admin)->assertUnprocessable();
        }
        $this->internal('PUT', 'planilla-settings', $this->data(), $this->admin)->assertOk()
            ->assertJsonPath('data.version', 1)->assertJsonPath('data.h1', 'JUNTA COMUNAL');
        $this->internal('PUT', 'planilla-settings', $this->data(), $this->admin)->assertConflict();
        $other = array_replace($this->admin, ['organization_id' => '33333333-3333-4333-8333-333333333333']);
        $this->internal('GET', 'planilla-settings', [], $other)->assertOk()->assertJsonPath('data.version', 0);
        $this->assertSame(1, DB::table('outbox_events')->where('action', 'planilla_settings.updated')->count());
    }

    public function test_delegation_revocation_and_export_visibility_are_enforced(): void
    {
        $version = 0;
        foreach (['registrar', 'treasurer', 'auditor', 'viewer'] as $role) {
            $delegate = array_replace($this->admin, ['role' => $role]);
            $this->internal('PUT', 'planilla-settings', $this->data($version) + ['delegated_roles' => [$role]], $this->admin)->assertOk();
            $version++;
            $this->internal('GET', 'planilla-settings', [], $delegate)->assertOk()
                ->assertJsonPath('data.can_manage', true)->assertJsonPath('data.can_delegate', false);
            $this->internal('PUT', 'planilla-settings', $this->data($version) + ['delegated_roles' => [$role]], $delegate)->assertForbidden();
            $this->internal('PUT', 'planilla-settings', $this->data($version), $delegate)->assertOk()->assertJsonPath('data.delegated_roles', [$role]);
            $version++;
            $stale = $version;
            $this->internal('PUT', 'planilla-settings', $this->data($version) + ['delegated_roles' => []], $this->admin)->assertOk();
            $version++;
            $this->internal('PUT', 'planilla-settings', $this->data($stale), $delegate)->assertForbidden();
            $this->internal('PUT', 'planilla-settings', $this->data($version), $delegate)->assertForbidden();
        }
        $this->internal('GET', 'persons/planilla', ['columns' => ['email']], $this->admin)->assertUnprocessable();
        $this->internal('GET', 'persons/planilla', ['columns' => ['zone']], $this->admin)->assertOk();
        $bytes = base64_decode($this->internal('GET', 'persons/planilla', [], $this->admin)->assertOk()->json('data.content'));
        $this->assertStringContainsString('JUNTA COMUNAL', $bytes);
        $this->assertStringContainsString('Sector norte', $bytes);
        $this->assertStringContainsString('ASISTENCIA', $bytes);
        $this->assertDatabaseMissing('outbox_events', ['action' => 'planilla_settings.updated', 'organization_id' => '33333333-3333-4333-8333-333333333333']);
    }
}
