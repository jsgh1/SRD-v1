<?php

namespace App\Application;

use App\Persistence\PersonRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Srd\Access;
use Srd\Outbox;

final class PersonService
{
    public function __construct(private PersonRepository $people, private PersonFields $fields) {}

    private function query(array $p)
    {
        return $this->people->forOrganization($p['organization_id']);
    }

    private function filters($q, array $filters): void
    {
        if (isset($filters['q']) && $filters['q'] !== '') {
            $needle = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $filters['q']).'%';
            $q->where(fn ($q) => $q->whereRaw("first_names LIKE ? ESCAPE '!'", [$needle])->orWhereRaw("last_names LIKE ? ESCAPE '!'", [$needle])->orWhereRaw("document_number LIKE ? ESCAPE '!'", [$needle]));
        }
        foreach (['status', 'zone', 'affiliated', 'document_type', 'gender', 'descriptive_role', 'position_code'] as $field) {
            if (isset($filters[$field]) && $filters[$field] !== '') {
                $q->where($field, $filters[$field]);
            }
        }
    }

    public function index(array $p, array $filters): array
    {
        if (isset($filters['position_code']) && $filters['position_code'] !== '') {
            $catalog = app(PersonPositions::class)->catalog($p['organization_id']);
            if (!in_array($filters['position_code'], array_column($catalog['items'], 'code'), true)) {
                throw \Illuminate\Validation\ValidationException::withMessages(['position_code' => 'El cargo no pertenece al catálogo de esta junta.']);
            }
        }
        $q = $this->query($p);
        $this->filters($q, $filters);
        $this->fields->filter($q, $p['organization_id'], $filters['custom_filters'] ?? []);
        $total = (clone $q)->count();
        $size = (int) ($filters['page_size'] ?? 10);
        $page = (int) ($filters['page'] ?? 1);

        return ['data' => ['items' => $q->orderByDesc('created_at')->orderByDesc('id')->forPage($page, $size)->get(), 'page' => $page, 'page_size' => $size, 'total' => $total]];
    }

    private function detail(array $p, string $id): array
    {
        $row = $this->query($p)->where('id', $id)->first();
        abort_unless($row, 404);
        $data = (array) $row;
        $data['custom_fields'] = (object) $this->fields->snapshots($p['organization_id'], $id);
        if (Access::allows($p['role'], 'persons.note')) {
            $data['note'] = DB::table('person_notes')->where('organization_id', $p['organization_id'])->where('person_id', $id)->value('body');
        }
        $data['authorization'] = DB::table('data_authorizations')->where('organization_id', $p['organization_id'])->where('person_id', $id)->first();
        Outbox::record('person.read', $p['organization_id'], $p['user_id'], $id);

        return $data;
    }

    public function show(array $p, string $id): array
    {
        return ['data' => $this->detail($p, $id)];
    }

    public function lookup(array $p, array $d): array
    {
        $id = $this->query($p)->where($d)->value('id');

        return ['data' => $id ? $this->detail($p, $id) : []];
    }

    public function save(array $p, array $d, ?string $id = null): array
    {
        return DB::transaction(function () use ($p, $d, $id) {
            $schema = $this->fields->schema($p['organization_id'], true);
            abort_unless((int) ($d['schema_version'] ?? 0) === $schema['version'], 409, 'Los campos de la junta cambiaron. Recarga el formulario antes de guardar.');
            $existing = $id ? $this->query($p)->where('id', $id)->lockForUpdate()->first() : null;
            $positions = app(PersonPositions::class);
            $catalog = $positions->catalog($p['organization_id'], true);
            abort_unless((int) ($d['positions_version'] ?? 0) === $catalog['version'], 409, 'Los cargos de la junta cambiaron. Recarga el formulario antes de guardar.');
            if ($id) {
                abort_unless($existing, 404);
                abort_unless($existing->version === $d['version'], 409);
            }
            $personId = $id ?? (string) Str::uuid();
            $d['position_label'] = $positions->label($catalog, array_key_exists('position_code', $d) ? $d['position_code'] : ($existing->position_code ?? null), $existing);
            unset($d['positions_version']);
            $values = $this->fields->validateValues($schema, $d['custom_values'] ?? [], $id ? $this->fields->snapshots($p['organization_id'], $id) : [], $d['status'] === 'complete');
            unset($d['custom_values'], $d['schema_version']);
            $note = $d['note'] ?? null;
            $basis = $d['authorization_basis'];
            $purpose = $d['authorization_purpose'];
            unset($d['note'],$d['authorization_basis'],$d['authorization_purpose']);
            $d['version'] = $existing ? $existing->version + 1 : 1;
            if (($d['zone'] ?? null) === 'rural') {
                $d['address'] = null;
                $d['neighborhood'] = null;
            }
            if (($d['zone'] ?? null) === 'urban') {
                $d['property_name'] = null;
            }
            if ($id) {
                $this->query($p)->where('id', $id)->update($d + ['updated_at' => now()]);
            } else {
                DB::table('persons')->insert($d + ['id' => $personId, 'organization_id' => $p['organization_id'], 'created_by' => $p['user_id'], 'created_at' => now(), 'updated_at' => now()]);
            }
            if ($note !== null) {
                // Notes remain separate from additional fields and their read permissions.
                DB::table('person_notes')->updateOrInsert(['person_id' => $personId, 'organization_id' => $p['organization_id']], ['body' => $note, 'updated_by' => $p['user_id'], 'updated_at' => now()]);
            }
            DB::table('data_authorizations')->updateOrInsert(['person_id' => $personId, 'organization_id' => $p['organization_id']], ['basis' => $basis, 'purpose' => $purpose, 'captured_by' => $p['user_id'], 'captured_at' => now()]);
            Outbox::record($id ? 'person.updated' : 'person.created', $p['organization_id'], $p['user_id'], $personId);
            $this->fields->persist($p['organization_id'], $personId, $values);

            return ['data' => ['id' => $personId, 'version' => $d['version']]];
        });
    }

    public function delete(array $p, array $d, string $id): array
    {
        DB::transaction(function () use ($p, $id, $d) {
            $row = $this->query($p)->where('id', $id)->lockForUpdate()->first();
            abort_unless($row, 404);
            abort_unless($row->version === $d['version'], 409);
            $this->query($p)->where('id', $id)->delete();
            DB::table('photo_deletions')->insert([
                'id' => (string) Str::uuid(), 'organization_id' => $p['organization_id'],
                'person_id' => $id, 'actor_id' => $p['user_id'],
                'correlation_id' => request()->attributes->get('correlation_id', (string) Str::uuid()),
                'created_at' => now(), 'next_attempt_at' => now(),
            ]);
            Outbox::record('person.deleted', $p['organization_id'], $p['user_id'], $id);
        });

        return ['data' => []];
    }

    public function dashboard(array $p): array
    {
        return DB::transaction(function () use ($p) {
        $q = $this->query($p);
        $generated = now('America/Bogota');
        $today = $generated->clone()->startOfDay();
        $end = $today->clone()->addDay()->utc();
        $count = fn ($start) => (clone $q)->where('created_at', '>=', $start->clone()->utc())->where('created_at', '<', $end)->count();
        $days = [];
        for ($i = 6; $i >= 0; $i--) {
            $start = $today->clone()->subDays($i);
            $days[] = ['date' => $start->toDateString(), 'count' => (clone $q)->where('created_at', '>=', $start->clone()->utc())->where('created_at', '<', $start->clone()->addDay()->utc())->count()];
        }

        return ['data' => ['date' => $today->toDateString(), 'generated_at' => $generated->clone()->utc()->toIso8601String(), 'timezone' => 'America/Bogota', 'total' => (clone $q)->count(), 'today' => $count($today), 'week' => $count($today->clone()->startOfWeek(\Carbon\CarbonInterface::MONDAY)), 'month' => $count($today->clone()->startOfMonth()), 'last_seven_days' => $days, 'gender' => (clone $q)->selectRaw('gender, count(*) as count')->groupBy('gender')->get(), 'document_types' => (clone $q)->selectRaw('document_type, count(*) as count')->groupBy('document_type')->get(), 'latest' => (clone $q)->orderByDesc('created_at')->orderByDesc('id')->limit(10)->get()]];
        });
    }
}
