<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Srd\Access;
use Srd\Outbox;

final class ProfileController
{
    public function update(Request $r): array
    {
        $p = Access::require('profile.write');
        $d = $r->validate(['name' => 'required|string|max:120', 'theme' => 'required|in:light,dark', 'presence' => 'required|in:online,away,dnd,invisible', 'role' => 'prohibited', 'email' => 'prohibited']);
        DB::transaction(function () use ($d, $p) {
            DB::table('users')->where('id', $p['user_id'])->update($d + ['updated_at' => now()]);
            Outbox::record('profile.updated', $p['organization_id'], $p['user_id'], $p['user_id']);
        });

        return ['data' => $d];
    }
}
