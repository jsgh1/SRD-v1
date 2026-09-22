<?php
namespace App\Http\Controllers;

use App\Application\PresenceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Srd\Access;

final class ContactController
{
    public function __invoke(Request $r, PresenceService $presence): array
    {
        $p = Access::require('contacts.read');
        $d = $r->validate(['q' => 'nullable|string|max:120', 'page' => 'sometimes|integer|min:1']);
        $query = DB::table('memberships as m')->join('users as u', 'u.id', '=', 'm.user_id')
            ->where('m.organization_id', $p['organization_id'])->where('m.active', true)->where('u.active', true)
            ->where('u.id', '!=', $p['user_id']);
        if (($d['q'] ?? '') !== '') {
            // Explicit escape character keeps literal %, _ and ! consistent on SQLite/MySQL.
            $needle = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $d['q']).'%';
            $query->whereRaw("u.name LIKE ? ESCAPE '!'", [$needle]);
        }
        $total = (clone $query)->count();
        $page = (int) ($d['page'] ?? 1);
        $items = $query->orderBy('u.name')->orderBy('u.id')->forPage($page, 25)
            ->get(['u.id', 'u.name', 'm.role', 'u.superadmin']);
        $states = $presence->effectiveMany($items->pluck('id')->all());
        return ['data' => ['items' => $items->map(fn ($u) => [
            'id' => $u->id, 'name' => $u->name, 'role' => $u->superadmin ? 'superadmin' : $u->role,
            'presence' => $states[$u->id] ?? 'offline',
        ]), 'page' => $page, 'page_size' => 25, 'total' => $total]];
    }
}
