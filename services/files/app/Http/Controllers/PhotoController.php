<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use SrdFiles\{ImageGate, PhotoStorage};

final class PhotoController
{
    private function principal(Request $request): array
    {
        return array_intersect_key($request->attributes->get('principal'), array_flip(['organization_id', 'user_id', 'role', 'session_id']))
            + ['correlation_id' => $request->attributes->get('correlation_id')];
    }

    public function index(Request $request, string $id): array
    {
        return ['data' => ['items' => app(PhotoStorage::class)->list($this->principal($request), strtolower($id))]];
    }

    public function show(Request $request, string $id, string $slot): array
    {
        $photo = app(PhotoStorage::class)->read($this->principal($request), strtolower($id), $slot);
        return ['data' => ['content' => base64_encode($photo['content']), 'mime' => 'image/png', 'version' => $photo['version']]];
    }

    public function store(Request $request, string $id, string $slot): array
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'content' => 'required|string|max:6990508',
            'version' => 'required|integer|min:0|max:2147483647',
        ]);
        $bytes = base64_decode($data['content'], true);
        if ($bytes === false || $bytes === '' || strlen($bytes) > ImageGate::MAX_BYTES || base64_encode($bytes) !== $data['content']) {
            throw ValidationException::withMessages(['content' => 'La fotografía debe usar base64 válido y pesar como máximo 5 MB.']);
        }
        return ['data' => app(PhotoStorage::class)->put($this->principal($request), strtolower($id), $slot, $data['name'], $bytes, (int) $data['version'])];
    }

    public function destroy(Request $request, string $id, string $slot): array
    {
        $data = $request->validate(['confirmed' => 'required|accepted', 'version' => 'required|integer|min:1|max:2147483647']);
        return ['data' => app(PhotoStorage::class)->delete($this->principal($request), strtolower($id), $slot, (int) $data['version'], true)];
    }
}
