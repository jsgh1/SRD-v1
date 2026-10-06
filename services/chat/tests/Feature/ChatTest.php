<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Srd\Testing\SignedRequests;
use Tests\TestCase;

final class ChatTest extends TestCase
{
    use RefreshDatabase, SignedRequests;

    private string $org = '11111111-1111-4111-8111-111111111111';
    private string $otherOrg = '99999999-9999-4999-8999-999999999999';
    private string $user = '22222222-2222-4222-8222-222222222222';
    private string $contact = '33333333-3333-4333-8333-333333333333';

    private function principal(?string $user = null, ?string $org = null): array
    {
        return ['user_id' => $user ?? $this->user, 'organization_id' => $org ?? $this->org,
            'role' => 'viewer', 'name' => $user === $this->contact ? 'Receptor' : 'Emisor'];
    }

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake(fn () => Http::response(['data' => ['id' => $this->contact, 'name' => 'Receptor', 'role' => 'viewer']]));
    }

    public function test_direct_pair_is_reused_and_tenant_scoped(): void
    {
        $first = $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal())
            ->assertOk()->json('data');
        $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal())
            ->assertOk()->assertJsonPath('data.id', $first['id']);
        $this->internal('GET', 'conversations', [], $this->principal())->assertOk()
            ->assertJsonPath('data.total', 1)->assertJsonPath('data.items.0.contact.id', $this->contact);
        $this->internal('GET', 'conversations', [], $this->principal(null, $this->otherOrg))
            ->assertJsonPath('data.total', 0);
        $this->internal('GET', 'conversations/'.$first['id'].'/messages', [], $this->principal(null, $this->otherOrg))->assertNotFound();
        $this->internal('GET', 'conversations/'.$first['id'].'/messages', [], $this->principal('44444444-4444-4444-8444-444444444444'))->assertNotFound();
        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('outbox_events', 1);
        $this->assertDatabaseMissing('outbox_events', ['action' => 'chat.message_sent']);
        Http::assertSentCount(2);
    }

    public function test_message_retry_is_exact_and_history_is_paginated(): void
    {
        $id = $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal())->json('data.id');
        $client = (string) Str::uuid();
        $body = str_repeat('á', 10000);
        $first = $this->internal('POST', 'conversations/'.$id.'/messages', ['client_id' => $client, 'body' => $body], $this->principal())
            ->assertOk()->json('data');
        $this->internal('POST', 'conversations/'.$id.'/messages', ['client_id' => $client, 'body' => $body], $this->principal())
            ->assertOk()->assertJsonPath('data.id', $first['id']);
        $this->internal('POST', 'conversations/'.$id.'/messages', ['client_id' => $client, 'body' => 'otro'], $this->principal())->assertStatus(409);
        $this->internal('POST', 'conversations/'.$id.'/messages', ['client_id' => (string) Str::uuid(), 'body' => '   '], $this->principal())->assertUnprocessable();
        $this->internal('POST', 'conversations/'.$id.'/messages', ['client_id' => (string) Str::uuid(), 'body' => str_repeat('x', 10001)], $this->principal())->assertUnprocessable();
        for ($i = 1; $i <= 25; $i++) {
            $this->internal('POST', 'conversations/'.$id.'/messages', ['client_id' => (string) Str::uuid(), 'body' => 'Mensaje '.$i], $this->principal())->assertOk();
        }
        $page = $this->internal('GET', 'conversations/'.$id.'/messages', [], $this->principal($this->contact))
            ->assertOk()->assertJsonCount(25, 'data.items')->json('data');
        $this->assertSame('Mensaje 1', $page['items'][0]['body']);
        $this->assertSame('Mensaje 25', $page['items'][24]['body']);
        $this->internal('GET', 'conversations/'.$id.'/messages', ['before' => $page['next_before']], $this->principal($this->contact))
            ->assertOk()->assertJsonCount(1, 'data.items')->assertJsonPath('data.items.0.id', $first['id']);
        $this->assertDatabaseCount('messages', 26);
        $this->assertDatabaseCount('outbox_events', 27);
        $audit = DB::table('outbox_events')->where('action', 'chat.message_sent')->first();
        $this->assertObjectNotHasProperty('body', $audit);
    }

    public function test_socket_failure_does_not_undo_a_committed_message(): void
    {
        config()->set('broadcasting.default', 'reverb');
        Broadcast::shouldReceive('presence')->andThrow(new \RuntimeException('Socket offline'));
        $id = $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal())
            ->assertOk()->json('data.id');
        $message = $this->internal('POST', 'conversations/'.$id.'/messages', [
            'client_id' => (string) Str::uuid(), 'body' => 'Mensaje persistido sin socket',
        ], $this->principal())->assertOk()->json('data');
        $this->assertDatabaseHas('messages', ['id' => $message['id'], 'body' => 'Mensaje persistido sin socket']);
        $this->internal('GET', 'conversations/'.$id.'/messages', [], $this->principal($this->contact))
            ->assertOk()->assertJsonPath('data.items.0.id', $message['id']);
    }

    public function test_untrusted_callers_and_invalid_contact_are_rejected(): void
    {
        $this->getJson('/internal/v1/conversations')->assertUnauthorized();
        $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal(), 'identity')->assertForbidden();
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(fn () => Http::response(['error' => ['fields' => ['user_id' => ['Elige un integrante activo.']]]], 422));
        $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal())->assertUnprocessable();
        $this->assertDatabaseCount('conversations', 0);
    }

    public function test_confirmed_retry_survives_contact_deactivation_but_new_send_is_rejected(): void
    {
        $id = $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal())->json('data.id');
        $payload = ['client_id' => (string) Str::uuid(), 'body' => 'Confirmado antes de suspensión'];
        $sent = $this->internal('POST', 'conversations/'.$id.'/messages', $payload, $this->principal())
            ->assertOk()->json('data');
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(fn () => Http::response(['error' => ['fields' => ['user_id' => ['Integrante inactivo.']]]], 422));
        $this->internal('POST', 'conversations/'.$id.'/messages', $payload, $this->principal())
            ->assertOk()->assertJsonPath('data.id', $sent['id']);
        $this->internal('POST', 'conversations/'.$id.'/messages', [
            'client_id' => (string) Str::uuid(), 'body' => 'Nuevo',
        ], $this->principal())->assertUnprocessable();
        $this->assertDatabaseCount('messages', 1);
        $this->assertDatabaseCount('outbox_events', 2);
    }

    public function test_only_recipient_can_confirm_exact_messages_and_states_are_monotonic(): void
    {
        $id = $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal())->json('data.id');
        $message = $this->internal('POST', 'conversations/'.$id.'/messages', [
            'client_id' => (string) Str::uuid(), 'body' => 'Texto privado',
        ], $this->principal())->assertOk()->json('data');
        $path = 'conversations/'.$id.'/receipts';
        $delivered = ['kind' => 'delivered', 'message_ids' => [$message['id']]];
        $this->internal('POST', $path, $delivered, $this->principal())->assertUnprocessable();
        $this->internal('POST', $path, $delivered, $this->principal(null, $this->otherOrg))->assertNotFound();
        $this->internal('POST', $path, $delivered, $this->principal('44444444-4444-4444-8444-444444444444'))->assertNotFound();
        $this->internal('POST', $path, ['kind' => 'delivered', 'message_ids' => [$message['id'], (string) Str::uuid()]], $this->principal($this->contact))->assertUnprocessable();
        $this->assertDatabaseHas('messages', ['id' => $message['id'], 'delivered_at' => null, 'read_at' => null]);

        $first = $this->internal('POST', $path, $delivered, $this->principal($this->contact))
            ->assertOk()->json('data.items.0');
        $this->assertNotNull($first['delivered_at']);
        $this->assertNull($first['read_at']);
        $this->internal('POST', $path, $delivered, $this->principal($this->contact))
            ->assertOk()->assertJsonPath('data.items.0.delivered_at', $first['delivered_at']);
        $read = $this->internal('POST', $path, ['kind' => 'read', 'message_ids' => [$message['id']]], $this->principal($this->contact))
            ->assertOk()->json('data.items.0');
        $this->assertSame($first['delivered_at'], $read['delivered_at']);
        $this->assertNotNull($read['read_at']);
        $this->internal('POST', $path, ['kind' => 'read', 'message_ids' => [$message['id']]], $this->principal($this->contact))
            ->assertOk()->assertJsonPath('data.items.0.read_at', $read['read_at']);
        $this->internal('GET', 'conversations/'.$id.'/messages', [], $this->principal())
            ->assertOk()->assertJsonPath('data.items.0.read_at', $read['read_at']);
        $this->assertDatabaseCount('outbox_events', 4);
        $this->assertDatabaseHas('outbox_events', ['action' => 'chat.messages_delivered', 'actor_id' => $this->contact]);
        $this->assertDatabaseHas('outbox_events', ['action' => 'chat.messages_read', 'actor_id' => $this->contact]);
    }

    public function test_read_directly_also_confirms_delivery_and_receipts_do_not_contain_body(): void
    {
        $id = $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal())->json('data.id');
        $message = $this->internal('POST', 'conversations/'.$id.'/messages', [
            'client_id' => (string) Str::uuid(), 'body' => 'Secreto de prueba',
        ], $this->principal())->json('data');
        $response = $this->internal('POST', 'conversations/'.$id.'/receipts', [
            'kind' => 'read', 'message_ids' => [$message['id']],
        ], $this->principal($this->contact))->assertOk();
        $this->assertNotNull($response->json('data.items.0.delivered_at'));
        $this->assertNotNull($response->json('data.items.0.read_at'));
        $this->assertStringNotContainsString('Secreto de prueba', $response->getContent());
        $this->assertDatabaseCount('outbox_events', 3);
    }

    public function test_message_creates_one_private_notification_job_and_retries_without_duplicate(): void
    {
        $id = $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal())->json('data.id');
        $this->internal('GET', 'conversations/'.$id, [], $this->principal($this->contact))->assertOk()
            ->assertJsonPath('data.contact.id', $this->user);
        $this->internal('GET', 'conversations/'.$id, [], $this->principal(null, $this->otherOrg))->assertNotFound();
        $payload = ['client_id' => (string) Str::uuid(), 'body' => 'Texto que no debe salir en el aviso'];
        $sent = $this->internal('POST', 'conversations/'.$id.'/messages', $payload, $this->principal())->json('data');
        $this->internal('POST', 'conversations/'.$id.'/messages', $payload, $this->principal())
            ->assertJsonPath('data.id', $sent['id']);
        $this->assertDatabaseCount('chat_delivery_jobs', 1);
        $job = DB::table('chat_delivery_jobs')->first();
        $this->assertSame($this->contact, $job->user_id);
        $this->assertSame($sent['id'], $job->message_id);
        $this->assertStringNotContainsString($payload['body'], json_encode($job));

        $fail = true;
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(function ($request) use (&$fail) {
            if (str_contains($request->url(), 'chat-contacts/resolve')) {
                return Http::response(['data' => ['id' => $this->contact, 'name' => 'Receptor', 'role' => 'viewer']]);
            }
            if ($fail) return Http::response(['error' => 'Temporal'], 503);
            return Http::response(['data' => ['id' => (string) Str::uuid()]]);
        });
        $delivery = app(\App\Application\ChatDeliveryService::class);
        $this->assertSame('retry', $delivery->deliverOne($job->id));
        $this->assertDatabaseHas('chat_delivery_jobs', ['id' => $job->id, 'attempts' => 1, 'delivered_at' => null]);
        DB::table('chat_delivery_jobs')->where('id', $job->id)->update(['next_attempt_at' => now()->subSecond()]);
        $fail = false;
        $this->assertSame('delivered', $delivery->deliverOne($job->id));
        $this->assertSame('skipped', $delivery->deliverOne($job->id));
        Http::assertSent(fn ($request) => str_contains($request->url(), '/deliveries')
            && $request['kind'] === 'chat_message' && $request['conversation_id'] === $id
            && $request['user_id'] === $this->contact && !str_contains($request->body(), $payload['body']));
        $this->assertDatabaseCount('outbox_events', 2);
    }

    public function test_inactive_recipient_discards_pending_notice_without_sending(): void
    {
        $id = $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal())->json('data.id');
        $this->internal('POST', 'conversations/'.$id.'/messages', [
            'client_id' => (string) Str::uuid(), 'body' => 'Privado',
        ], $this->principal())->assertOk();
        $job = DB::table('chat_delivery_jobs')->first();
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(fn () => Http::response(['error' => ['fields' => ['user_id' => ['Integrante inactivo.']]]], 422));
        $this->assertSame('discarded', app(\App\Application\ChatDeliveryService::class)->deliverOne($job->id));
        $this->assertDatabaseCount('chat_delivery_jobs', 0);
        Http::assertSentCount(1);
    }

    public function test_new_message_cursor_keeps_every_page_and_refreshes_own_receipts(): void
    {
        $id = $this->internal('POST', 'conversations', ['user_id' => $this->contact], $this->principal())->json('data.id');
        $messageIds = [];
        for ($number = 1; $number <= 27; $number++) {
            $messageIds[] = $this->internal('POST', 'conversations/'.$id.'/messages', [
                'client_id' => (string) Str::uuid(), 'body' => 'Número '.$number,
            ], $this->principal())->assertOk()->json('data.id');
        }
        $path = 'conversations/'.$id.'/messages';
        $latest = $this->internal('GET', $path, [], $this->principal())->assertOk()->json('data');
        $this->assertCount(25, $latest['items']);
        $this->assertSame('Número 3', $latest['items'][0]['body']);
        $this->internal('GET', $path, ['before' => $latest['next_before']], $this->principal())
            ->assertOk()->assertJsonCount(2, 'data.items');
        $first = $this->internal('GET', $path, ['after' => 0], $this->principal())->assertOk()->json('data');
        $this->assertSame('Número 1', $first['items'][0]['body']);
        $this->assertSame('Número 25', $first['items'][24]['body']);
        $this->assertNotNull($first['next_after']);
        $second = $this->internal('GET', $path, ['after' => $first['next_after']], $this->principal())
            ->assertOk()->json('data');
        $this->assertCount(2, $second['items']);
        $this->assertSame('Número 26', $second['items'][0]['body']);
        $this->assertSame('Número 27', $second['items'][1]['body']);
        $this->assertNull($second['next_after']);
        $this->internal('GET', $path, ['after' => $second['items'][1]['sequence']], $this->principal())
            ->assertOk()->assertJsonCount(0, 'data.items');

        $this->internal('POST', 'conversations/'.$id.'/receipts', [
            'kind' => 'read', 'message_ids' => [$messageIds[0]],
        ], $this->principal($this->contact))->assertOk();
        $status = $this->internal('GET', $path, ['after' => $second['items'][1]['sequence'],
            'receipt_ids' => [$messageIds[0]]], $this->principal())->assertOk()->json('data');
        $this->assertNotNull($status['receipts'][0]['read_at']);
        $this->internal('GET', $path, ['after' => 0, 'before' => 2], $this->principal())->assertUnprocessable();
        $this->internal('GET', $path, ['after' => 0, 'receipt_ids' => [$messageIds[0]]], $this->principal($this->contact))->assertUnprocessable();
        $this->internal('GET', $path, ['after' => 0, 'receipt_ids' => [(string) Str::uuid()]], $this->principal())->assertUnprocessable();
        $this->internal('GET', $path, ['after' => 0], $this->principal(null, $this->otherOrg))->assertNotFound();
        $this->assertDatabaseCount('messages', 27);
    }
}
