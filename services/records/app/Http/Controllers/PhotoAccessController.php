<?php

namespace App\Http\Controllers;

use App\Persistence\PersonRepository;
use Illuminate\Http\Request;
use Srd\Access;

/** Internal decision only: no person fields, notes or persistent access grants. */
final class PhotoAccessController
{
    public function __invoke(Request $request, string $id, PersonRepository $persons): array
    {
        abort_unless($request->attributes->get('issuer') === 'files', 403);
        $data = $request->validate(['action' => 'required|in:persons.read,persons.write']);
        $principal = Access::require($data['action']);
        abort_unless($persons->forOrganization($principal['organization_id'])->where('id', $id)->exists(), 404);

        return ['data' => ['authorized' => true]];
    }
}
