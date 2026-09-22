<?php

use App\Http\Controllers\AuditController;
use Illuminate\Support\Facades\Route;

Route::middleware('internal')->group(function () {
    Route::post('events', [AuditController::class, 'ingest']);
    Route::get('events', [AuditController::class, 'index']);
});
