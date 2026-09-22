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
