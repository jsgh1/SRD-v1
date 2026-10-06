<?php

namespace App\Http\Controllers;

use App\Application\PersonService;
use App\Http\Validation\PersonInput;
use Illuminate\Http\Request;
use Srd\Access;

final class PersonController
{
    public function __construct(private PersonService $service) {}

    public function index(Request $r): array
    {
        $p = Access::require('persons.read');

        return $this->service->index($p, PersonInput::filters($r));
    }

    public function export(Request $r): array
    {
        abort_unless($r->attributes->get('issuer') === 'gateway', 403);
        $p = Access::require('persons.export');
        $filters = PersonInput::filters($r);
        $name = $r->validate([
            'filename' => 'sometimes|nullable|string|max:100',
            'confirm_filename' => 'sometimes|boolean',
        ]);
        return $this->service->export($p, $filters, $name['filename'] ?? null, (bool) ($name['confirm_filename'] ?? false));
    }

    public function exportIndividual(Request $r, string $id): array
    {
        abort_unless($r->attributes->get('issuer') === 'gateway', 403);
        $p = Access::require('persons.export');
        $name = $r->validate(['filename' => 'sometimes|nullable|string|max:100', 'confirm_filename' => 'sometimes|boolean']);
        return $this->service->exportIndividual($p, $id, $name['filename'] ?? null, (bool) ($name['confirm_filename'] ?? false));
    }

    public function exportIndividualPdf(Request $r, string $id): array
    {
        abort_unless($r->attributes->get('issuer') === 'gateway', 403);
        $p = Access::require('persons.export');
        $name = $r->validate(['filename' => 'sometimes|nullable|string|max:100', 'confirm_filename' => 'sometimes|boolean']);
        return $this->service->exportIndividualPdf($p, $id, $name['filename'] ?? null, (bool) ($name['confirm_filename'] ?? false));
    }

    public function exportPdf(Request $r): array
    {
        abort_unless($r->attributes->get('issuer') === 'gateway', 403);
        $p = Access::require('persons.export');
        $filters = PersonInput::filters($r);
        $name = $r->validate([
            'filename' => 'sometimes|nullable|string|max:100',
            'confirm_filename' => 'sometimes|boolean',
        ]);
        return $this->service->exportPdf($p, $filters, $name['filename'] ?? null, (bool) ($name['confirm_filename'] ?? false));
    }

    public function planilla(Request $r): array
    {
        [$p, $filters, $input, $headings] = $this->planillaRequest($r);
        return $this->service->exportPlanilla($p, $filters, $input['columns'] ?? [], $headings,
            $input['filename'] ?? null, (bool) ($input['confirm_filename'] ?? false));
    }

    public function planillaPreview(Request $r): array
    {
        [$p, $filters, $input, $headings] = $this->planillaRequest($r);
        return $this->service->previewPlanilla($p, $filters, $input['columns'] ?? [], $headings,
            $input['filename'] ?? null, (bool) ($input['confirm_filename'] ?? false));
    }

    public function planillaPdf(Request $r): array
    {
        [$p, $filters, $input, $headings] = $this->planillaRequest($r);
        return $this->service->pdfPlanilla($p, $filters, $input['columns'] ?? [], $headings,
            $input['filename'] ?? null, (bool) ($input['confirm_filename'] ?? false));
    }

    private function planillaRequest(Request $r): array
    {
        abort_unless($r->attributes->get('issuer') === 'gateway', 403);
        $p = Access::require('persons.export');
        $filters = PersonInput::filters($r);
        $input = $r->validate([
            'columns' => 'sometimes|array|list|max:5',
            'columns.*' => 'required|string|distinct:strict|in:email,phone,property_name,zone,position_label,descriptive_role,status,affiliated',
            'h1' => 'sometimes|nullable|string|max:120',
            'h2' => 'sometimes|nullable|string|max:120',
            'h3' => 'sometimes|nullable|string|max:120',
            'filename' => 'sometimes|nullable|string|max:100',
            'confirm_filename' => 'sometimes|boolean',
        ]);
        $headings = array_intersect_key($input, array_flip(['h1', 'h2', 'h3']));
        return [$p, $filters, $input, $headings];
    }

    public function show(string $id): array
    {
        return $this->service->show(Access::require('persons.read'), $id);
    }

    public function lookup(Request $r): array
    {
        $p = Access::require('persons.read');
        $d = $r->validate(['document_type' => 'required|in:RC,TI,CC,CE,NIT', 'document_number' => 'required|string|max:30']);

        return $this->service->lookup($p, $d);
    }

    public function save(Request $r, ?string $id = null): array
    {
        $p = Access::require('persons.write');
        $d = PersonInput::save($r);
        if ($id) {
            $r->validate(['version' => 'required|integer|min:1']);
        }

        return $this->service->save($p, $d, $id);
    }

    public function delete(Request $r, string $id): array
    {
        $p = Access::require('persons.delete');
        $d = $r->validate(['confirmed' => 'required|accepted', 'version' => 'required|integer|min:1']);

        return $this->service->delete($p, $d, $id);
    }

    public function dashboard(): array
    {
        return $this->service->dashboard(Access::require('dashboard.read'));
    }
}
