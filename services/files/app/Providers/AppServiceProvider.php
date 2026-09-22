<?php
namespace App\Providers;

use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Srd\InternalClient;
use SrdFiles\{ClamdScanner, ImageGate, PhotoStorage, PhotoStore, RecordsPhotoAuthorizer};

final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PhotoStorage::class, function () {
            return new PhotoStore(
                DB::connection()->getPdo(),
                config('photos.objects'),
                new ImageGate(config('photos.quarantine'), new \SrdFiles\UpdatedScanner(new ClamdScanner(config('photos.scanner'), 15), config('photos.signature_marker'))),
                Closure::fromCallable(new RecordsPhotoAuthorizer(new InternalClient)),
                config('photos.quota'),
            );
        });
    }
}
