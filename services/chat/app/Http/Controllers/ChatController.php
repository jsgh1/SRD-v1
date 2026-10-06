<?php

namespace App\Http\Controllers;

use App\Application\ChatService;
use Illuminate\Http\Request;
use Srd\Access;

final class ChatController
{
    public function __construct(private ChatService $chat) {}

    private function principal(): array
    {
        abort_unless(request()->attributes->get('issuer') === 'gateway', 403);
        return Access::require('chat.read');
    }

    public function index(Request $request): array
    {
        $data = $request->validate(['page' => 'sometimes|integer|min:1|max:100000']);
        return $this->chat->list($this->principal(), (int) ($data['page'] ?? 1));
    }

    public function show(string $id): array
    {
        return $this->chat->show($this->principal(), $id);
    }

    public function start(Request $request): array
    {
        $data = $request->validate(['user_id' => 'required|uuid']);
        return $this->chat->start($this->principal(), $data['user_id']);
    }

    public function messages(Request $request, string $id): array
    {
        $data = $request->validate([
            'before' => 'sometimes|integer|min:1', 'after' => 'sometimes|integer|min:0',
            'receipt_ids' => 'sometimes|array|max:25', 'receipt_ids.*' => 'required|uuid|distinct',
        ]);
        if (isset($data['before'], $data['after'])) {
            throw \Illuminate\Validation\ValidationException::withMessages(['after' => 'Elige antes o después, no ambos.']);
        }
        return $this->chat->messages($this->principal(), $id,
            isset($data['before']) ? (int) $data['before'] : null,
            isset($data['after']) ? (int) $data['after'] : null,
            $data['receipt_ids'] ?? []);
    }

    public function send(Request $request, string $id): array
    {
        $data = $request->validate(['client_id' => 'required|uuid', 'body' => 'required|string|min:1|max:10000']);
        return $this->chat->send($this->principal(), $id, $data);
    }

    public function receipt(Request $request, string $id): array
    {
        $data = $request->validate([
            'kind' => 'required|in:delivered,read',
            'message_ids' => 'required|array|min:1|max:25',
            'message_ids.*' => 'required|uuid|distinct',
        ]);
        return $this->chat->confirmReceipt($this->principal(), $id, $data['kind'], $data['message_ids']);
    }
}
