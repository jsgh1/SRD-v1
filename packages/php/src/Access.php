<?php

namespace Srd;

final class Access
{
    public const ROLES = ['superadmin', 'admin', 'registrar', 'treasurer', 'auditor', 'viewer'];

    public static function allows(string $role, string $action): bool
    {
        if (! in_array($role, self::ROLES, true)) {
            return false;
        }

        return match ($action) {
            'platform.manage' => $role === 'superadmin',
            'organization.manage','persons.delete','members.manage' => in_array($role, ['superadmin', 'admin'], true),
            'persons.write','persons.note' => in_array($role, ['superadmin', 'admin', 'registrar'], true),
            'treasury.read','treasury.write','treasury.export','inventory.read','inventory.write','inventory.export' => in_array($role, ['superadmin', 'admin', 'treasurer'], true),
            'audit.read','audit.export' => in_array($role, ['superadmin', 'admin', 'auditor'], true),
            'persons.read','persons.export','profile.write','dashboard.read','downloads.read','contacts.read' => true,
            default => false,
        };
    }

    public static function require(string $action): array
    {
        $p = request()->attributes->get('principal', []);
        abort_unless(! empty($p['organization_id']) && ! empty($p['user_id']) && self::allows($p['role'] ?? '', $action), 403);

        return $p;
    }
}
