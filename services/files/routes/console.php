<?php
require __DIR__.'/../../../packages/php/console.php';

\Illuminate\Support\Facades\Artisan::command('srd:documents-collect', function () {
    $this->line(json_encode(['removed'=>app(\SrdFiles\FolderDocumentStore::class)->collect()]));
})->purpose('Retirar documentos eliminados y cargas incompletas de más de quince minutos');
\Illuminate\Support\Facades\Schedule::command('srd:documents-collect')->everyMinute()->withoutOverlapping();

\Illuminate\Support\Facades\Artisan::command('srd:photos-collect', function () {
    $store = app(\SrdFiles\PhotoStorage::class);
    $removed = 0;
    foreach (\Illuminate\Support\Facades\DB::table('file_garbage')->select('organization_id')->distinct()->orderBy('organization_id')->limit(100)->get() as $row) {
        $removed += $store->collect($row->organization_id, 25);
    }
    $this->line(json_encode(['removed' => $removed]));
})->purpose('Retirar objetos reemplazados o borrados; liberar cuota solo tras la retirada');
\Illuminate\Support\Facades\Schedule::command('srd:photos-collect')->everyMinute()->withoutOverlapping();
