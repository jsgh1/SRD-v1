<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Schema;
use Srd\OutboxPublisher;

Artisan::command('srd:outbox', function () {
    if (! Schema::hasTable('outbox_events')) {
        return;
    }
    $this->line(json_encode(app(OutboxPublisher::class)->publishBatch(), JSON_THROW_ON_ERROR));
})->purpose('Publicar eventos durables con reintentos y consumidor idempotente');
Artisan::command('srd:outbox-status', function () {
    if (! Schema::hasTable('outbox_events')) {
        $this->error('La tabla de eventos no está disponible. Ejecuta las migraciones.');
        return 1;
    }
    $this->line(json_encode(app(OutboxPublisher::class)->status(), JSON_THROW_ON_ERROR));
})->purpose('Consultar pendientes y agotados sin modificar ni reenviar eventos');
Schedule::command('srd:outbox')->everyMinute()->withoutOverlapping();
