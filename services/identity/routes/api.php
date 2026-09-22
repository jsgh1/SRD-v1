<?php

\Illuminate\Support\Facades\Route::post('platform/organizations/{id}/administrators', [\App\Http\Controllers\MembershipController::class, 'inviteAdministrator'])->middleware('internal')->whereUuid('id');

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailChangeController;
use App\Http\Controllers\MembershipController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

Route::middleware('internal')->group(function () {
    Route::get('contacts', \App\Http\Controllers\ContactController::class);
    Route::post('auth/presence', function (\Illuminate\Http\Request $r, \App\Application\PresenceService $presence) {
        $d = $r->validate(['token' => 'required|string|max:256']);
        return ['data' => $presence->heartbeat($d['token'])];
    });
    Route::get('outbox-status', \Srd\OutboxStatusController::class);
    Route::get('members', [MembershipController::class, 'index']);
    Route::patch('members/{id}', [MembershipController::class, 'update'])->whereUuid('id');
    Route::get('invitations', [MembershipController::class, 'invitations']);
    Route::post('invitations', [MembershipController::class, 'invite']);
    Route::delete('invitations/{id}', [MembershipController::class, 'revoke'])->whereUuid('id');
    Route::post('invitations/inspect', [MembershipController::class, 'inspect']);
    Route::post('invitations/accept', [MembershipController::class, 'accept']);
    Route::post('profile/email-change', [EmailChangeController::class, 'request']);
    Route::post('profile/email-change/resend', [EmailChangeController::class, 'resend']);
    Route::post('profile/email-change/confirm', [EmailChangeController::class, 'confirm']);
    Route::patch('profile', [ProfileController::class, 'update']);
    foreach (['login', 'verify', 'resend', 'cancel', 'me', 'logout', 'recover', 'reset', 'revokeOthers', 'switchOrganization'] as $action) {
        Route::post('auth/'.$action, [AuthController::class, $action]);
    }
});
