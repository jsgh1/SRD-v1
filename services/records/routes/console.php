<?php

require __DIR__.'/../../../packages/php/console.php';

\Illuminate\Support\Facades\Artisan::command('srd:photos-dispatch-deletions', function () {
    $this->line(json_encode(app(\App\Application\PhotoDeletionPublisher::class)->publishBatch()));
})->purpose('Entregar órdenes persistentes de limpieza de fotos tras borrar personas');
\Illuminate\Support\Facades\Schedule::command('srd:photos-dispatch-deletions')->everyMinute()->withoutOverlapping();
