<?php

namespace App\Application;

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Srd\Outbox;
use Srd\ExportFilename;

final class InventoryService
{
    private function fingerprint(array $parts): string
    {
        return hash('sha256', json_encode($parts, JSON_THROW_ON_ERROR));
    }

    private function asset(object $row): array
    {
        return [
            'id' => $row->id, 'code' => $row->code, 'type' => $row->type, 'name' => $row->name,
            'category' => $row->category, 'unit' => $row->unit, 'description' => $row->description,
            'location' => $row->location, 'condition' => $row->condition,
            'responsible_name' => $row->responsible_name, 'quantity' => (int) $row->quantity,
            'status' => $row->status, 'version' => (int) $row->version,
            'created_by' => $row->created_by, 'updated_by' => $row->updated_by,
            'retired_at' => $row->retired_at, 'created_at' => $row->created_at,
        ];
    }

    private function movementRow(object $row): array
    {
        return [
            'id' => $row->id, 'asset_id' => $row->asset_id, 'sequence' => (int) $row->sequence, 'type' => $row->type,
            'delta' => (int) $row->delta, 'quantity_before' => (int) $row->quantity_before,
            'quantity_after' => (int) $row->quantity_after, 'reason' => $row->reason,
            'performed_by' => $row->performed_by, 'performer_name' => $row->performer_name,
            'created_at' => $row->created_at,
        ];
    }

    private function previous(string $org, string $key, string $hash): ?array
    {
        $movement = DB::table('asset_movements')->where('organization_id', $org)->where('idempotency_key', $key)->first();
        if (!$movement) return null;
        abort_unless(hash_equals($movement->payload_hash, $hash), 409, 'La clave ya se usó con otros datos.');
        return ['data' => [
            'asset' => $this->asset(DB::table('assets')->where('id', $movement->asset_id)->first()),
            'movement' => $this->movementRow($movement),
        ]];
    }

    private function record(array $principal, object $asset, string $type, int $before, int $after,
        string $reason, string $key, string $hash): array
    {
        $id = (string) Str::uuid();
        $sequence = 1 + (int) DB::table('asset_movements')->where('asset_id', $asset->id)->max('sequence');
        DB::table('asset_movements')->insert([
            'id' => $id, 'organization_id' => $principal['organization_id'], 'asset_id' => $asset->id, 'sequence' => $sequence,
            'type' => $type, 'delta' => $after - $before, 'quantity_before' => $before,
            'quantity_after' => $after, 'reason' => $reason, 'performed_by' => $principal['user_id'],
            'performer_name' => $principal['name'], 'idempotency_key' => $key, 'payload_hash' => $hash,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        Outbox::record('inventory.'.$type.'_recorded', $principal['organization_id'], $principal['user_id'], $asset->id);
        return ['data' => [
            'asset' => $this->asset(DB::table('assets')->where('id', $asset->id)->first()),
            'movement' => $this->movementRow(DB::table('asset_movements')->where('id', $id)->first()),
        ]];
    }

    private function filteredAssets(array $principal, array $data)
    {
        $query = DB::table('assets')->where('organization_id', $principal['organization_id']);
        if (isset($data['type'])) $query->where('type', $data['type']);
        if (isset($data['status'])) $query->where('status', $data['status']);
        if (!empty($data['q'])) {
            $term = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], trim($data['q'])).'%';
            $query->where(fn ($q) => $q->whereRaw("code LIKE ? ESCAPE '!'", [$term])
                ->orWhereRaw("name LIKE ? ESCAPE '!'", [$term]));
        }
        return $query;
    }

    public function index(array $principal, array $data): array
    {
        $query = $this->filteredAssets($principal, $data);
        $page = (int) ($data['page'] ?? 1);
        return ['data' => [
            'items' => (clone $query)->orderByDesc('created_at')->orderByDesc('id')->forPage($page, 25)->get()->map($this->asset(...))->all(),
            'total' => (clone $query)->count(), 'page' => $page, 'page_size' => 25,
        ]];
    }

    public function export(array $principal, array $data): array
    {
        $filename = ExportFilename::xlsx('inventario', $data['filename'] ?? null, (bool) ($data['confirm_filename'] ?? false));
        $assets = $this->exportAssets($principal, $data);
        $content = base64_encode(InventoryWorkbook::create($assets));
        Outbox::record('inventory.export', $principal['organization_id'], $principal['user_id'], null);
        return ['data' => [
            'filename' => $filename,
            'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'content' => $content,
            'count' => $assets->count(),
        ]];
    }

    public function exportPdf(array $principal, array $data): array
    {
        $filename = ExportFilename::pdf('inventario', $data['filename'] ?? null, (bool) ($data['confirm_filename'] ?? false));
        $assets = $this->exportAssets($principal, $data);
        $table = InventoryWorkbook::table($assets);
        Outbox::record('inventory.export', $principal['organization_id'], $principal['user_id'], null);
        return ['data' => ['filename' => $filename, 'date' => now('America/Bogota')->toDateString(),
            'count' => $assets->count()] + $table];
    }

    private function exportAssets(array $principal, array $data)
    {
        $assets = $this->filteredAssets($principal, $data)->orderBy('code')->orderBy('id')->limit(2001)->get();
        if ($assets->count() > 2000) throw ValidationException::withMessages(['export' => 'La consulta supera 2000 bienes. Acota los filtros antes de exportar.']);
        return $assets;
    }

    public function show(array $principal, string $id, int $movementPage = 1, array $filters = []): array
    {
        $asset = DB::table('assets')->where('organization_id', $principal['organization_id'])->where('id', $id)->first();
        abort_unless($asset, 404);
        $movements = $this->filteredMovements($principal, $id, $filters);
        return ['data' => [
            'asset' => $this->asset($asset),
            'movements' => (clone $movements)->orderByDesc('sequence')->forPage($movementPage, 25)
                ->get()->map($this->movementRow(...))->all(),
            'movement_page' => $movementPage, 'movement_page_size' => 25,
            'movement_total' => (clone $movements)->count(),
        ]];
    }

    private function filteredMovements(array $principal, string $id, array $filters)
    {
        $movements = DB::table('asset_movements')->where('organization_id', $principal['organization_id'])
            ->where('asset_id', $id);
        if (isset($filters['movement_type'])) $movements->where('type', $filters['movement_type']);
        if (!empty(trim($filters['movement_q'] ?? ''))) {
            $term = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], trim($filters['movement_q'])).'%';
            $movements->whereRaw("reason LIKE ? ESCAPE '!'", [$term]);
        }
        if (isset($filters['movement_from'])) {
            $start = \Carbon\CarbonImmutable::createFromFormat('!Y-m-d', $filters['movement_from'], 'America/Bogota')->utc();
            $movements->where('created_at', '>=', $start->format('Y-m-d H:i:s'));
        }
        if (isset($filters['movement_to'])) {
            $end = \Carbon\CarbonImmutable::createFromFormat('!Y-m-d', $filters['movement_to'], 'America/Bogota')->addDay()->utc();
            $movements->where('created_at', '<', $end->format('Y-m-d H:i:s'));
        }
        return $movements;
    }

    public function exportMovements(array $principal, string $id, array $data, bool $pdf = false): array
    {
        $filename = $pdf ? ExportFilename::pdf('movimientos_inventario', $data['filename'] ?? null, (bool) ($data['confirm_filename'] ?? false))
            : ExportFilename::xlsx('movimientos_inventario', $data['filename'] ?? null, (bool) ($data['confirm_filename'] ?? false));
        return DB::transaction(function () use ($principal, $id, $data, $filename, $pdf) {
            $asset = DB::table('assets')->where('organization_id', $principal['organization_id'])->where('id', $id)->lockForUpdate()->first();
            abort_unless($asset, 404);
            $movements = $this->filteredMovements($principal, $id, $data)->orderByDesc('sequence')->limit(2001)->get();
            if ($movements->count() > 2000) throw ValidationException::withMessages(['export' => 'La consulta supera 2000 movimientos. Acota los filtros antes de exportar.']);
            $labels = ['opening' => 'Registro inicial', 'in' => 'Entrada', 'out' => 'Salida', 'adjust' => 'Ajuste', 'retire' => 'Baja'];
            $table = ['headers' => ['Código del bien', 'Nombre del bien', 'N.º', 'Fecha UTC', 'Operación', 'Cambio', 'Existencia anterior', 'Existencia posterior', 'Motivo', 'Responsable', 'ID del movimiento'], 'rows' => []];
            foreach ($movements as $movement) {
                $table['rows'][] = [$asset->code, $asset->name, $movement->sequence, $movement->created_at,
                    $labels[$movement->type], $movement->delta, $movement->quantity_before, $movement->quantity_after,
                    $movement->reason, $movement->performer_name, $movement->id];
            }
            Outbox::record('inventory.export', $principal['organization_id'], $principal['user_id'], $id);
            if ($pdf) {
                $table['rows'] = array_map(fn ($row) => array_map(fn ($value) => (string) ($value ?? ''), $row), $table['rows']);
                return ['data' => ['filename' => $filename, 'date' => now('America/Bogota')->toDateString(), 'count' => $movements->count()] + $table];
            }
            $content = base64_encode(InventoryWorkbook::fromTable($table));
            return ['data' => ['filename' => $filename, 'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'content' => $content, 'count' => $movements->count()]];
        }, 3);
    }

    public function store(array $principal, array $data): array
    {
        $type = $data['type'];
        if ($type === 'real_estate' && (int) $data['quantity'] !== 1) {
            throw ValidationException::withMessages(['quantity' => 'Un inmueble representa una sola unidad.']);
        }
        if ($type === 'movable' && (empty($data['category']) || empty($data['unit']))) {
            throw ValidationException::withMessages(['category' => 'Los muebles requieren categoría y unidad.']);
        }
        $code = strtoupper(trim($data['code']));
        $fields = [
            'code' => $code, 'type' => $type, 'name' => trim($data['name']),
            'category' => isset($data['category']) ? trim($data['category']) : null,
            'unit' => $type === 'movable' ? trim($data['unit']) : null,
            'description' => isset($data['description']) ? trim($data['description']) : null,
            'location' => trim($data['location']), 'condition' => trim($data['condition']),
            'responsible_name' => isset($data['responsible_name']) ? trim($data['responsible_name']) : null,
            'quantity' => (int) $data['quantity'],
        ];
        $hash = $this->fingerprint([$principal['user_id'], 'opening', $fields]);
        $make = function () use ($principal, $data, $fields, $hash) {
            $org = $principal['organization_id'];
            if ($previous = $this->previous($org, $data['idempotency_key'], $hash)) return $previous;
            $id = (string) Str::uuid();
            DB::table('assets')->insert($fields + [
                'id' => $id, 'organization_id' => $org, 'status' => 'active', 'version' => 1,
                'created_by' => $principal['user_id'], 'updated_by' => $principal['user_id'],
                'created_at' => now(), 'updated_at' => now(),
            ]);
            return $this->record($principal, (object) ['id' => $id], 'opening', 0,
                $fields['quantity'], 'Registro inicial', $data['idempotency_key'], $hash);
        };
        try { return DB::transaction($make, 3); }
        catch (UniqueConstraintViolationException $error) {
            if ($previous = $this->previous($principal['organization_id'], $data['idempotency_key'], $hash)) return $previous;
            throw $error;
        }
    }

    public function update(array $principal, string $id, array $data): array
    {
        return DB::transaction(function () use ($principal, $id, $data) {
            $asset = DB::table('assets')->where('organization_id', $principal['organization_id'])->where('id', $id)->lockForUpdate()->first();
            abort_unless($asset, 404);
            abort_unless($asset->status === 'active' && (int) $asset->version === (int) $data['version'], 409);
            if ($asset->type === 'movable' && (empty($data['category']) || empty($data['unit']))) {
                throw ValidationException::withMessages(['category' => 'Los muebles requieren categoría y unidad.']);
            }
            DB::table('assets')->where('id', $id)->update([
                'name' => trim($data['name']), 'category' => isset($data['category']) ? trim($data['category']) : null,
                'unit' => $asset->type === 'movable' ? trim($data['unit']) : null,
                'description' => isset($data['description']) ? trim($data['description']) : null,
                'location' => trim($data['location']), 'condition' => trim($data['condition']),
                'responsible_name' => isset($data['responsible_name']) ? trim($data['responsible_name']) : null,
                'version' => (int) $asset->version + 1, 'updated_by' => $principal['user_id'], 'updated_at' => now(),
            ]);
            Outbox::record('inventory.asset_updated', $principal['organization_id'], $principal['user_id'], $id);
            return ['data' => $this->asset(DB::table('assets')->where('id', $id)->first())];
        }, 3);
    }

    public function movement(array $principal, string $id, array $data): array
    {
        $quantity = (int) $data['quantity'];
        if ($data['type'] !== 'adjust' && $quantity === 0) throw ValidationException::withMessages(['quantity' => 'La cantidad debe ser positiva.']);
        $reason = trim($data['reason']);
        $hash = $this->fingerprint([$principal['user_id'], $id, $data['type'], $quantity, $reason]);
        $result = DB::transaction(function () use ($principal, $id, $data, $quantity, $reason, $hash) {
            $org = $principal['organization_id'];
            $asset = DB::table('assets')->where('organization_id', $org)->where('id', $id)->lockForUpdate()->first();
            abort_unless($asset, 404);
            if ($previous = $this->previous($org, $data['idempotency_key'], $hash)) return $previous;
            abort_unless($asset->type === 'movable' && $asset->status === 'active', 409);
            $before = (int) $asset->quantity;
            $after = match ($data['type']) { 'in' => $before + $quantity, 'out' => $before - $quantity, 'adjust' => $quantity };
            if ($after < 0 || $after > 1000000000) {
                Outbox::record('inventory.movement_rejected', $org, $principal['user_id'], $id, 'rejected');
                return ['rejected' => true];
            }
            if ($after === $before) throw ValidationException::withMessages(['quantity' => 'El ajuste debe cambiar la existencia.']);
            DB::table('assets')->where('id', $id)->update(['quantity' => $after, 'version' => (int) $asset->version + 1,
                'updated_by' => $principal['user_id'], 'updated_at' => now()]);
            return $this->record($principal, $asset, $data['type'], $before, $after, $reason, $data['idempotency_key'], $hash);
        }, 3);
        abort_if(isset($result['rejected']), 422, 'La salida supera las existencias disponibles.');
        return $result;
    }

    public function retire(array $principal, string $id, array $data): array
    {
        $reason = trim($data['reason']);
        $hash = $this->fingerprint([$principal['user_id'], $id, 'retire', (int) $data['version'], $reason]);
        return DB::transaction(function () use ($principal, $id, $data, $reason, $hash) {
            $org = $principal['organization_id'];
            $asset = DB::table('assets')->where('organization_id', $org)->where('id', $id)->lockForUpdate()->first();
            abort_unless($asset, 404);
            if ($previous = $this->previous($org, $data['idempotency_key'], $hash)) return $previous;
            abort_unless($asset->status === 'active' && (int) $asset->version === (int) $data['version'], 409);
            if ($asset->type === 'movable' && (int) $asset->quantity !== 0) {
                throw ValidationException::withMessages(['quantity' => 'Registra la salida o ajuste a cero antes de la baja.']);
            }
            $before = (int) $asset->quantity;
            DB::table('assets')->where('id', $id)->update(['status' => 'retired', 'quantity' => 0,
                'version' => (int) $asset->version + 1, 'retired_at' => now(),
                'updated_by' => $principal['user_id'], 'updated_at' => now()]);
            return $this->record($principal, $asset, 'retire', $before, 0, $reason, $data['idempotency_key'], $hash);
        }, 3);
    }
}
