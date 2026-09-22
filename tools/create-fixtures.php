<?php
// Synthetic local fixtures only. No input document or ZIP data is used.
$root=getenv('SRD_ROOT') ?: dirname(__DIR__);$service=$argv[1]??'';
if(!in_array($service,['identity','configuration'],true))exit(1);
require "$root/services/$service/vendor/autoload.php";
$app=require "$root/services/$service/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if(!app()->environment('local') || (config('database.default')!=='sqlite' && getenv('SRD_ALLOW_MYSQL_FIXTURES')!=='1'))throw new RuntimeException('Fixtures require an explicitly selected isolated local environment.');
$file=getenv('SRD_FIXTURE_PATH') ?: "$root/.local/e2e-fixture.json";
if(is_file($file))$fixture=json_decode(file_get_contents($file),true);
else {
 $fixture=['password'=>bin2hex(random_bytes(18)),'orgA'=>'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','orgB'=>'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','termsA'=>'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','termsB'=>'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','users'=>[]];
 foreach(['admin','registrar','treasurer','auditor','viewer','superadmin'] as $role)$fixture['users'][$role]=['id'=>(string)Illuminate\Support\Str::uuid(),'email'=>"$role@srd-e2e.test"];
 file_put_contents($file,json_encode($fixture,JSON_PRETTY_PRINT));
}
Illuminate\Support\Facades\DB::transaction(function()use($service,$fixture){
 if($service==='configuration')foreach(['A','B']as $letter){
  $id=$fixture['org'.$letter];
  Illuminate\Support\Facades\DB::table('organizations')->insertOrIgnore(['id'=>$id,'code'=>$fixture['code'.$letter] ?? 'srd-e2e-'.strtolower($letter),'name'=>'Junta de prueba '. $letter,'created_at'=>now(),'updated_at'=>now()]);
  Illuminate\Support\Facades\DB::table('terms_versions')->insertOrIgnore(['id'=>$fixture['terms'.$letter],'organization_id'=>$id,'version'=>1,'body'=>'Términos ficticios de desarrollo. Este entorno solo contiene cuentas y personas sintéticas para verificar SRD. No introducir información real.','published_at'=>now()]);
 }else foreach($fixture['users']as $role=>$user){
  Illuminate\Support\Facades\DB::table('users')->insertOrIgnore(['id'=>$user['id'],'email'=>$user['email'],'name'=>'Prueba '.ucfirst($role),'password'=>Illuminate\Support\Facades\Hash::make($fixture['password']),'superadmin'=>$role==='superadmin','created_at'=>now(),'updated_at'=>now()]);
  Illuminate\Support\Facades\DB::table('memberships')->insertOrIgnore(['id'=>(string)Illuminate\Support\Str::uuid(),'user_id'=>$user['id'],'organization_id'=>$fixture['orgA'],'role'=>$role]);
 }
});
echo "Synthetic fixtures ready: $service. Credentials remain in the selected local fixture.\n";
