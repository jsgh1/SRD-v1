<?php
namespace App\Application;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Srd\Outbox;

final class PersonPositions
{
    public function defaults(): array {
        $items = [];
        foreach (['president'=>'Presidente','vicepresident'=>'Vicepresidente','secretary'=>'Secretario','treasurer'=>'Tesorero','fiscal'=>'Fiscal','other'=>'Otro'] as $code => $label) $items[] = ['code'=>$code,'label'=>$label,'active'=>true];
        return $items;
    }
    public function catalog(string $org, bool $lock = false): array {
        if ($lock) DB::table('person_position_catalogs')->upsert([['organization_id'=>$org,'version'=>0,'items'=>json_encode($this->defaults()),'created_at'=>now(),'updated_at'=>now()]], ['organization_id'], ['organization_id']);
        $q = DB::table('person_position_catalogs')->where('organization_id', $org);
        if ($lock) $q->lockForUpdate();
        $row = $q->first();
        return $row ? ['version'=>(int)$row->version,'items'=>json_decode($row->items, true, 512, JSON_THROW_ON_ERROR)] : ['version'=>0,'items'=>$this->defaults()];
    }
    public function configure(array $p, array $d): array {
        return DB::transaction(function () use ($p, $d) {
            $old = $this->catalog($p['organization_id'], true);
            abort_unless($old['version'] === (int)$d['version'], 409, 'Los cargos cambiaron. Recarga antes de guardar.');
            $codes = array_column($d['items'], 'code');
            foreach ($old['items'] as $item) if (!in_array($item['code'], $codes, true)) throw ValidationException::withMessages(['items'=>'Los cargos guardados se desactivan; no se eliminan ni cambian de identificador.']);
            if (!array_filter($d['items'], fn ($i) => $i['active'])) throw ValidationException::withMessages(['items'=>'Conserva al menos un cargo activo.']);
            $version = $old['version'] + 1;
            DB::table('person_position_catalogs')->where('organization_id', $p['organization_id'])->update(['version'=>$version,'items'=>json_encode($d['items'], JSON_THROW_ON_ERROR),'updated_at'=>now()]);
            Outbox::record('person_positions.updated', $p['organization_id'], $p['user_id'], $p['organization_id']);
            return ['data'=>['version'=>$version,'items'=>$d['items']]];
        });
    }
    public function label(array $catalog, ?string $code, ?object $previous): ?string {
        if ($code === null) return null;
        $item = array_column($catalog['items'], null, 'code')[$code] ?? null;
        if (!$item || (!$item['active'] && $code !== ($previous->position_code ?? null))) throw ValidationException::withMessages(['position_code'=>'El cargo no está disponible en esta junta.']);
        return $code === ($previous->position_code ?? null) ? ($previous->position_label ?? $item['label']) : $item['label'];
    }
}
