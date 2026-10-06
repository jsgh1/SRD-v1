<?php

require __DIR__.'/../../../packages/php/console.php';

\Illuminate\Support\Facades\Artisan::command('srd:chat-deliveries', function () {
    if (!\Illuminate\Support\Facades\Schema::hasTable('chat_delivery_jobs')) return;
    $this->line(json_encode(app(\App\Application\ChatDeliveryService::class)->deliverBatch(), JSON_THROW_ON_ERROR));
})->purpose('Entregar avisos de Chat con reintentos e idempotencia');

\Illuminate\Support\Facades\Schedule::command('srd:chat-deliveries')->everyMinute()->withoutOverlapping();
