<?php
namespace App\Application;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Srd\InternalClient;
use Srd\DependencyFailure;

/** Durable, independent from audit delivery; duplicate delivery is safe at Files. */
final class PhotoDeletionPublisher
{
    public function __construct(private InternalClient $client) {}
    public function publishOne(string $id): string {
        return DB::transaction(function () use ($id) {
            $row = DB::table('photo_deletions')->where('id', $id)->lockForUpdate()->first();
            if (!$row || $row->delivered_at || Carbon::parse($row->next_attempt_at)->gt(now())) return 'skipped';
            try {
                $ack = $this->client->call('files', 'POST', 'photo-deletions/'.$row->person_id, [], [
                    'organization_id' => $row->organization_id, 'user_id' => $row->actor_id,
                    'correlation_id' => $row->correlation_id,
                ]);
                if (($ack['accepted'] ?? null) !== true) throw new DependencyFailure;
            } catch (\Throwable) {
                $attempt = min((int) $row->attempts + 1, 1000000);
                DB::table('photo_deletions')->where('id', $id)->update([
                    'attempts' => $attempt, 'next_attempt_at' => now()->addMinutes([1,5,15,60][min($attempt-1,3)]),
                ]);
                return 'retry';
            }
            DB::table('photo_deletions')->where('id', $id)->update(['delivered_at' => now()]);
            return 'delivered';
        });
    }
    public function publishBatch(): array {
        $counts = ['delivered'=>0,'retry'=>0,'skipped'=>0];
        $ids = DB::table('photo_deletions')->whereNull('delivered_at')->where('next_attempt_at','<=',now())
            ->orderBy('next_attempt_at')->orderBy('id')->limit(10)->pluck('id');
        foreach ($ids as $id) {
            $result = $this->publishOne($id); $counts[$result]++;
            if ($result === 'retry') break; // Do not multiply dependency timeouts in one scheduler run.
        }
        return $counts;
    }
}
