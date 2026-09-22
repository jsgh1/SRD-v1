<?php
use App\Http\Controllers\PhotoController;
use Illuminate\Support\Facades\Route;

Route::post('photo-deletions/{id}', \App\Http\Controllers\PhotoDeletionController::class)->whereUuid('id')->middleware('internal');

Route::middleware(['internal', \App\Http\Middleware\PhotoContext::class])->group(function () {
    Route::get('persons/{id}/photos', [PhotoController::class, 'index'])->whereUuid('id');
    Route::get('persons/{id}/photos/{slot}', [PhotoController::class, 'show'])->whereUuid('id')->whereIn('slot', ['person', 'document', 'property']);
    Route::put('persons/{id}/photos/{slot}', [PhotoController::class, 'store'])->whereUuid('id')->whereIn('slot', ['person', 'document', 'property']);
    Route::delete('persons/{id}/photos/{slot}', [PhotoController::class, 'destroy'])->whereUuid('id')->whereIn('slot', ['person', 'document', 'property']);
});
