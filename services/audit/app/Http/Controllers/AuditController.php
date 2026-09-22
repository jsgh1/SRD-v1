<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Srd\Access;

final class AuditController
{
    public function ingest(Request $r): array
    {
        $d = $r->validate(['id' => 'required|uuid', 'organization_id' => 'nullable|uuid', 'actor_id' => 'nullable|uuid', 'service' => 'required|in:identity,configuration,records,files', 'action' => 'required|string|max:100', 'resource_id' => 'nullable|uuid', 'result' => 'required|in:success,rejected,failed', 'correlation_id' => 'required|uuid', 'occurred_at' => 'required|date', 'event_version' => 'required|in:1']);
        abort_unless($r->attributes->get('issuer') === $d['service'], 403);
        DB::table('audit_events')->insertOrIgnore($d);

        return ['data' => ['accepted' => true]];
    }

    public function index(Request $r): array
    {
        $p = Access::require('audit.read');
        $d = $r->validate([
            'page' => 'sometimes|integer|min:1|max:1000000',
            'page_size' => 'sometimes|integer|in:10,25,50',
            'action' => 'nullable|string|max:100',
            'result' => 'nullable|in:success,rejected,failed',
            'service' => 'nullable|in:identity,configuration,records,files',
            'actor_id' => 'nullable|uuid',
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => ['nullable', 'date_format:Y-m-d', ...($r->filled('date_from') ? ['after_or_equal:date_from'] : [])],
        ]);
        $q = DB::table('audit_events')->where('organization_id', $p['organization_id']);
        foreach (['action', 'result', 'service', 'actor_id'] as $f) {
            if (isset($d[$f]) && $d[$f] !== '') {
                $q->where($f, $d[$f]);
            }
        }
        // Inclusive UTC days, with an exclusive next-day upper bound for microseconds.
        if (! empty($d['date_from'])) $q->where('occurred_at', '>=', $d['date_from'].' 00:00:00');
        if (! empty($d['date_to'])) $q->where('occurred_at', '<', Carbon::createFromFormat('!Y-m-d', $d['date_to'], 'UTC')->addDay()->toDateTimeString());
        $total = (clone $q)->count();
        $page = (int) ($d['page'] ?? 1);
        $size = (int) ($d['page_size'] ?? 25);

        return ['data' => ['items' => $q->orderByDesc('occurred_at')->orderByDesc('id')->forPage($page, $size)->get(), 'total' => $total, 'page' => $page, 'page_size' => $size]];
    }
}
