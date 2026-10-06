<?php

use App\Http\Controllers\ChatController;
use Illuminate\Support\Facades\Route;

Route::middleware('internal')->group(function () {
    Route::get('outbox-status', \Srd\OutboxStatusController::class);
    Route::post('outbox-status/{id}/retry', \Srd\OutboxRetryController::class)->whereUuid('id');
    Route::get('conversations', [ChatController::class, 'index']);
    Route::post('conversations', [ChatController::class, 'start']);
    Route::get('conversations/{id}', [ChatController::class, 'show'])->whereUuid('id');
    Route::get('conversations/{id}/messages', [ChatController::class, 'messages'])->whereUuid('id');
    Route::post('conversations/{id}/messages', [ChatController::class, 'send'])->whereUuid('id');
    Route::post('conversations/{id}/receipts', [ChatController::class, 'receipt'])->whereUuid('id');
});

\Illuminate\Support\Facades\Route::get('scheduler-status', \Srd\SchedulerHealthController::class)->middleware('internal');
