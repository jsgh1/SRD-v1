<?php

use App\Http\Controllers\GatewayController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('api/v1')->middleware('throttle:120,1,srd-global:')->group(function () {
    Route::get('persons/{id}/photos', fn (Request $r, GatewayController $g, string $id) => $g->forward($r, 'files', 'persons/'.$id.'/photos'))->whereUuid('id');
    Route::match(['GET', 'PUT', 'DELETE'], 'persons/{id}/photos/{slot}', fn (Request $r, GatewayController $g, string $id, string $slot) => $g->forward($r, 'files', 'persons/'.$id.'/photos/'.$slot))->whereUuid('id')->whereIn('slot', ['person','document','property']);
    Route::match(['GET', 'PUT'], 'person-fields', fn (Request $r, GatewayController $g) => $g->forward($r, 'records', 'person-fields'));
    Route::match(['GET', 'PUT'], 'person-filter-settings', fn (Request $r, GatewayController $g) => $g->forward($r, 'records', 'person-filter-settings'));
    Route::match(['GET', 'PUT'], 'person-positions', fn (Request $r, GatewayController $g) => $g->forward($r, 'records', 'person-positions'));
    Route::get('audit-delivery/{service}', fn (Request $r, GatewayController $g, string $service) => $g->forward($r, $service, 'outbox-status'))->whereIn('service', ['identity', 'configuration', 'records']);
    Route::get('quick-links', fn (Request $r, GatewayController $g) => $g->forward($r, 'configuration', 'quick-links'));
    Route::patch('quick-links/{scope}', fn (Request $r, GatewayController $g, string $scope) => $g->forward($r, 'configuration', 'quick-links/'.$scope))->whereIn('scope', ['organization', 'personal']);
    Route::post('platform/organizations/{id}/administrators', fn (Request $r, GatewayController $g, string $id) => $g->forward($r, 'identity', 'platform/organizations/'.$id.'/administrators'))->whereUuid('id');
    Route::match(['GET', 'POST'], 'platform/organizations', fn (Request $r, GatewayController $g) => $g->forward($r, 'configuration', 'platform/organizations'));
    Route::patch('platform/organizations/{id}', fn (Request $r, GatewayController $g, string $id) => $g->forward($r, 'configuration', 'platform/organizations/'.$id))->whereUuid('id');
    Route::get('csrf', fn () => ['data' => ['token' => csrf_token()]]);
    Route::get('organizations/{code}', [GatewayController::class, 'publicConfig']);
    Route::post('auth/{action}', [GatewayController::class, 'auth'])->middleware('throttle:20,1,srd-auth:');
    Route::get('me', [GatewayController::class, 'me']);
    Route::get('contacts', fn (Request $r, GatewayController $g) => $g->forward($r, 'identity', 'contacts'));
    Route::post('presence/heartbeat', [GatewayController::class, 'presence']);
    Route::post('invitations/inspect', fn (Request $r, GatewayController $g) => $g->invitation($r, 'inspect'))->middleware('throttle:20,1,srd-invitation-public:');
    Route::post('invitations/accept', fn (Request $r, GatewayController $g) => $g->invitation($r, 'accept'))->middleware('throttle:20,1,srd-invitation-public:');
    Route::get('members', fn (Request $r, GatewayController $g) => $g->forward($r, 'identity', 'members'));
    Route::patch('members/{id}', fn (Request $r, GatewayController $g, string $id) => $g->forward($r, 'identity', 'members/'.$id))->whereUuid('id');
    Route::match(['GET', 'POST'], 'invitations', fn (Request $r, GatewayController $g) => $g->forward($r, 'identity', 'invitations'));
    Route::delete('invitations/{id}', fn (Request $r, GatewayController $g, string $id) => $g->forward($r, 'identity', 'invitations/'.$id))->whereUuid('id');
    Route::get('dashboard', fn (Request $r, GatewayController $g) => $g->forward($r, 'records', 'dashboard'));
    Route::match(['GET', 'POST'], 'persons', fn (Request $r, GatewayController $g) => $g->forward($r, 'records', 'persons'));
    Route::get('persons/lookup', fn (Request $r, GatewayController $g) => $g->forward($r, 'records', 'persons/lookup'));
    Route::match(['GET', 'PATCH', 'DELETE'], 'persons/{id}', fn (Request $r, GatewayController $g, string $id) => $g->forward($r, 'records', 'persons/'.$id))->whereUuid('id');
    Route::patch('organization', fn (Request $r, GatewayController $g) => $g->forward($r, 'configuration', 'organization'));
    Route::post('organization/terms', fn (Request $r, GatewayController $g) => $g->forward($r, 'configuration', 'organization/terms'));
    Route::get('audit-events', fn (Request $r, GatewayController $g) => $g->forward($r, 'audit', 'events'));
    Route::patch('profile', fn (Request $r, GatewayController $g) => $g->forward($r, 'identity', 'profile'));
    Route::post('profile/email-change', fn (Request $r, GatewayController $g) => $g->forward($r, 'identity', 'profile/email-change'))->middleware('throttle:10,1,srd-email:');
    Route::post('profile/email-change/resend', fn (Request $r, GatewayController $g) => $g->forward($r, 'identity', 'profile/email-change/resend'))->middleware('throttle:10,1,srd-email:');
    Route::post('profile/email-change/confirm', fn (Request $r, GatewayController $g) => $g->forward($r, 'identity', 'profile/email-change/confirm'))->middleware('throttle:10,1,srd-email:');
    Route::get('releases', function (Request $r, GatewayController $g) {
        $g->me($r);

        return ['data' => []];
    });
});
