<?php

namespace App\Application;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Srd\InternalClient;
use Srd\Outbox;

final class ChatService
{
    public function __construct(private InternalClient $identity, private ChatDeliveryService $delivery,
        private ChatSignal $signal) {}

    private function participant(array $principal, string $id, bool $lock = false): object
    {
        $query = DB::table('conversations')->where('id', $id)
            ->where('organization_id', $principal['organization_id'])
            ->where(fn ($q) => $q->where('user_a_id', $principal['user_id'])
                ->orWhere('user_b_id', $principal['user_id']));
        $row = ($lock ? $query->lockForUpdate() : $query)->first();
        abort_unless($row, 404);
        return $row;
    }

    private function present(object $row, string $userId): array
    {
        $isA = $row->user_a_id === $userId;
        return ['id' => $row->id, 'contact' => ['id' => $isA ? $row->user_b_id : $row->user_a_id,
            'name' => $isA ? $row->user_b_name : $row->user_a_name],
            'created_at' => CarbonImmutable::parse($row->created_at, 'UTC')->toIso8601String(),
            'updated_at' => CarbonImmutable::parse($row->updated_at, 'UTC')->toIso8601String()];
    }

    private function message(object $row): array
    {
        return ['id' => $row->id, 'sequence' => (int) $row->sequence,
            'sender_id' => $row->sender_id, 'body' => $row->body,
            'created_at' => CarbonImmutable::parse($row->created_at, 'UTC')->toIso8601String(),
            'delivered_at' => $row->delivered_at ? CarbonImmutable::parse($row->delivered_at, 'UTC')->toIso8601String() : null,
            'read_at' => $row->read_at ? CarbonImmutable::parse($row->read_at, 'UTC')->toIso8601String() : null];
    }

    public function list(array $principal, int $page): array
    {
        $query = DB::table('conversations')->where('organization_id', $principal['organization_id'])
            ->where(fn ($q) => $q->where('user_a_id', $principal['user_id'])
                ->orWhere('user_b_id', $principal['user_id']));
        $total = (clone $query)->count();
        $rows = $query->orderByDesc('updated_at')->orderByDesc('id')->forPage($page, 25)->get();
        return ['data' => ['items' => $rows->map(fn ($row) => $this->present($row, $principal['user_id']))->all(),
            'page' => $page, 'page_size' => 25, 'total' => $total]];
    }

    public function show(array $principal, string $id): array
    {
        return ['data' => $this->present($this->participant($principal, $id), $principal['user_id'])];
    }

    public function start(array $principal, string $contactId): array
    {
        $contact = $this->identity->call('identity', 'POST', 'chat-contacts/resolve',
            ['user_id' => $contactId], ['organization_id' => $principal['organization_id'], 'user_id' => $principal['user_id']]);
        $userId = $principal['user_id'];
        $a = strcmp($userId, $contactId) < 0 ? $userId : $contactId;
        $b = $a === $userId ? $contactId : $userId;
        $name = trim((string) ($principal['name'] ?? ''));
        abort_unless($name !== '', 403);
        $row = DB::transaction(function () use ($principal, $contact, $userId, $a, $b, $name) {
            $org = $principal['organization_id'];
            $id = (string) Str::uuid();
            $created = DB::table('conversations')->insertOrIgnore([
                'id' => $id, 'organization_id' => $org, 'user_a_id' => $a, 'user_b_id' => $b,
                'user_a_name' => $a === $userId ? $name : $contact['name'],
                'user_b_name' => $b === $userId ? $name : $contact['name'],
                'created_at' => now(), 'updated_at' => now(),
            ]);
            if ($created) Outbox::record('chat.conversation_started', $org, $userId, $id);
            return DB::table('conversations')->where('organization_id', $org)
                ->where('user_a_id', $a)->where('user_b_id', $b)->first();
        });
        $this->signal->changed($principal['organization_id'], $row->user_a_id, $row->user_b_id);
        return ['data' => $this->present($row, $userId)];
    }

    public function messages(array $principal, string $id, ?int $before, ?int $after, array $receiptIds): array
    {
        $this->participant($principal, $id);
        $query = DB::table('messages')->where('organization_id', $principal['organization_id'])
            ->where('conversation_id', $id);
        if ($before !== null) $query->where('sequence', '<', $before);
        if ($after !== null) $query->where('sequence', '>', $after);
        $items = $query->orderBy('sequence', $after !== null ? 'asc' : 'desc')->limit(25)
            ->get(['sequence', 'id', 'sender_id', 'body', 'created_at', 'delivered_at', 'read_at']);
        $receiptRows = collect();
        if ($receiptIds) {
            $receiptRows = DB::table('messages')->where('organization_id', $principal['organization_id'])
                ->where('conversation_id', $id)->where('sender_id', $principal['user_id'])
                ->whereIn('id', $receiptIds)->get(['id', 'delivered_at', 'read_at'])->keyBy('id');
            if ($receiptRows->count() !== count($receiptIds)) {
                throw ValidationException::withMessages(['receipt_ids' => 'Selecciona únicamente mensajes enviados por ti en esta conversación.']);
            }
        }
        return ['data' => [
            'items' => ($after === null ? $items->reverse()->values() : $items)->map(fn ($row) => $this->message($row))->all(),
            'next_before' => $after === null && $items->count() === 25 ? $items->last()->sequence : null,
            'next_after' => $after !== null && $items->count() === 25 ? $items->last()->sequence : null,
            'receipts' => array_map(fn ($messageId) => [
                'id' => $messageId,
                'delivered_at' => $receiptRows[$messageId]->delivered_at ? CarbonImmutable::parse($receiptRows[$messageId]->delivered_at, 'UTC')->toIso8601String() : null,
                'read_at' => $receiptRows[$messageId]->read_at ? CarbonImmutable::parse($receiptRows[$messageId]->read_at, 'UTC')->toIso8601String() : null,
            ], $receiptIds),
        ]];
    }

    public function send(array $principal, string $id, array $data): array
    {
        if (trim($data['body']) === '') {
            throw ValidationException::withMessages(['body' => 'Escribe un mensaje.']);
        }
        $conversation = $this->participant($principal, $id);
        $existing = DB::table('messages')->where('organization_id', $principal['organization_id'])
            ->where('conversation_id', $id)->where('sender_id', $principal['user_id'])
            ->where('client_id', $data['client_id'])->first();
        if ($existing) {
            abort_unless($existing->body === $data['body'], 409);
            return ['data' => $this->message($existing)];
        }
        $contactId = $conversation->user_a_id === $principal['user_id'] ? $conversation->user_b_id : $conversation->user_a_id;
        $this->identity->call('identity', 'POST', 'chat-contacts/resolve', ['user_id' => $contactId],
            ['organization_id' => $principal['organization_id'], 'user_id' => $principal['user_id']]);
        $row = DB::transaction(function () use ($principal, $id, $data, $contactId) {
            $this->participant($principal, $id, true);
            $org = $principal['organization_id'];
            $user = $principal['user_id'];
            $existing = DB::table('messages')->where('conversation_id', $id)
                ->where('sender_id', $user)->where('client_id', $data['client_id'])->first();
            if ($existing) {
                abort_unless($existing->body === $data['body'], 409);
                return $existing;
            }
            $messageId = (string) Str::uuid();
            $sequence = DB::table('messages')->insertGetId(['id' => $messageId,
                'organization_id' => $org, 'conversation_id' => $id, 'sender_id' => $user,
                'client_id' => $data['client_id'], 'body' => $data['body'], 'created_at' => now()], 'sequence');
            DB::table('conversations')->where('id', $id)->where('organization_id', $org)->update(['updated_at' => now()]);
            Outbox::record('chat.message_sent', $org, $user, $messageId);
            $this->delivery->enqueue($org, $id, $messageId, $contactId);
            return DB::table('messages')->where('sequence', $sequence)->first();
        });
        $this->signal->changed($principal['organization_id'], $conversation->user_a_id, $conversation->user_b_id);
        return ['data' => $this->message($row)];
    }

    public function confirmReceipt(array $principal, string $id, string $kind, array $messageIds): array
    {
        $conversation = $this->participant($principal, $id);
        $result = DB::transaction(function () use ($principal, $id, $kind, $messageIds) {
            $this->participant($principal, $id, true);
            $query = DB::table('messages')->where('organization_id', $principal['organization_id'])
                ->where('conversation_id', $id)->whereIn('id', $messageIds)
                ->where('sender_id', '!=', $principal['user_id']);
            if ((clone $query)->count() !== count($messageIds)) {
                throw ValidationException::withMessages(['message_ids' => 'Selecciona únicamente mensajes recibidos de esta conversación.']);
            }
            $at = now();
            if ($kind === 'delivered') {
                $changed = (clone $query)->whereNull('delivered_at')->update(['delivered_at' => $at]);
            } else {
                (clone $query)->whereNull('delivered_at')->update(['delivered_at' => $at]);
                $changed = (clone $query)->whereNull('read_at')->update(['read_at' => $at]);
            }
            if ($changed) {
                Outbox::record($kind === 'read' ? 'chat.messages_read' : 'chat.messages_delivered',
                    $principal['organization_id'], $principal['user_id'], $id);
            }
            $rows = (clone $query)->get(['id', 'delivered_at', 'read_at'])->keyBy('id');
            return ['data' => ['items' => array_map(fn ($messageId) => [
                'id' => $messageId,
                'delivered_at' => $rows[$messageId]->delivered_at ? CarbonImmutable::parse($rows[$messageId]->delivered_at, 'UTC')->toIso8601String() : null,
                'read_at' => $rows[$messageId]->read_at ? CarbonImmutable::parse($rows[$messageId]->read_at, 'UTC')->toIso8601String() : null,
            ], $messageIds)]];
        });
        $this->signal->changed($principal['organization_id'], $conversation->user_a_id, $conversation->user_b_id);
        return $result;
    }
}
