<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Srd\Access;

final class PhotoContext
{
    public function handle(Request $request, Closure $next)
    {
        abort_unless($request->attributes->get('issuer') === 'gateway', 403);
        $principal = Access::require($request->isMethod('GET') ? 'persons.read' : 'persons.write');
        foreach (['organization_id', 'user_id', 'session_id'] as $key) {
            abort_unless(is_string($principal[$key] ?? null) && Str::isUuid($principal[$key]), 403);
        }
        abort_if(strlen($request->getContent()) > 7 * 1024 * 1024, 413);

        return $next($request);
    }
}
