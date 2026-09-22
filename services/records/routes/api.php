<?php

use App\Http\Controllers\PersonController;
use Illuminate\Support\Facades\Route;

Route::middleware('internal')->group(function () {
    Route::get('person-filter-settings', [\App\Http\Controllers\PersonFilterSettingsController::class, 'index']);
    Route::put('person-filter-settings', [\App\Http\Controllers\PersonFilterSettingsController::class, 'update']);
    Route::post('persons/{id}/photo-access', \App\Http\Controllers\PhotoAccessController::class)->whereUuid('id');
    Route::get('person-positions', [\App\Http\Controllers\PersonPositionController::class, 'index']);
    Route::put('person-positions', [\App\Http\Controllers\PersonPositionController::class, 'update']);
    Route::get('person-fields', [\App\Http\Controllers\PersonFieldController::class, 'index']);
    Route::put('person-fields', [\App\Http\Controllers\PersonFieldController::class, 'update']);
    Route::get('outbox-status', \Srd\OutboxStatusController::class);
    $c = PersonController::class;
    Route::get('dashboard', [$c, 'dashboard']);
    Route::get('persons', [$c, 'index']);
    Route::post('persons', [$c, 'save']);
    Route::get('persons/lookup', [$c, 'lookup']);
    Route::get('persons/{id}', [$c, 'show'])->whereUuid('id');
    Route::patch('persons/{id}', [$c, 'save'])->whereUuid('id');
    Route::delete('persons/{id}', [$c, 'delete'])->whereUuid('id');
});
