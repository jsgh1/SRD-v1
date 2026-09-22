<?php
namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Srd\Access;
use Srd\Testing\SignedRequests;
use Tests\TestCase;

final class PersonBaseFiltersTest extends TestCase
{
    use RefreshDatabase, SignedRequests;
    private array $p = ['organization_id'=>'11111111-1111-4111-8111-111111111111','user_id'=>'22222222-2222-4222-8222-222222222222','role'=>'admin'];
    private function create(string $number, array $extra = [], ?array $principal = null): string
    {
        return $this->internal('POST', 'persons', array_replace([
            'document_type'=>'CC','document_number'=>$number,'first_names'=>'Persona sintética',
            'status'=>'pending','gender'=>'female','descriptive_role'=>'viewer','position_code'=>'president',
            'affiliated'=>true,'zone'=>'rural','note'=>'Contenido reservado',
            'authorization_basis'=>'Prueba local','authorization_purpose'=>'Verificar filtros',
        ], $extra), $principal ?? $this->p)->assertOk()->json('data.id');
    }
    public function test_each_filter_and_combination_paginate_without_crossing_juntas_or_exposing_notes(): void
    {
        $ids=[];
        for ($i=0;$i<11;$i++) $ids[]=$this->create('BASE-'.$i);
        foreach (['document_type'=>'TI','gender'=>'male','descriptive_role'=>'admin','position_code'=>'fiscal'] as $key=>$value) {
            $this->create('OTHER-'.str_replace('_','-',$key),[$key=>$value]);
            $this->internal('GET','persons',[$key=>$value],$this->p)->assertOk()->assertJsonPath('data.total',1)->assertJsonPath('data.items.0.'.$key,$value);
        }
        $other=array_replace($this->p,['organization_id'=>'33333333-3333-4333-8333-333333333333']);
        $this->create('BASE-0',[],$other);
        $filters=['document_type'=>'CC','gender'=>'female','descriptive_role'=>'viewer','position_code'=>'president','affiliated'=>'1','zone'=>'rural','status'=>'pending','q'=>'sintética'];
        foreach (Access::ROLES as $role) {
            $p=array_replace($this->p,['role'=>$role]);
            $response=$this->internal('GET','persons',$filters,$p)->assertOk()->assertJsonPath('data.total',11)->assertJsonCount(10,'data.items');
            foreach ($response->json('data.items') as $item) {
                $this->assertContains($item['id'],$ids);
                $this->assertArrayNotHasKey('note',$item);
            }
            $this->internal('GET','persons',$filters+['page'=>2],$p)->assertOk()->assertJsonPath('data.total',11)->assertJsonCount(1,'data.items');
        }
        $this->internal('GET','persons',array_replace($filters,['gender'=>'other']),$this->p)->assertOk()->assertJsonPath('data.total',0);
        $this->internal('GET','persons',[],$this->p)->assertOk()->assertJsonPath('data.total',15);
    }
    public function test_inactive_cargo_is_searchable_and_foreign_or_invalid_criteria_are_rejected(): void
    {
        $id=$this->create('HISTORY');
        $items=app(\App\Application\PersonPositions::class)->defaults();
        $items[0]['active']=false; $items[0]['label']='Presidencia anterior';
        $items[]=['code'=>'vocal-local','label'=>'Vocal local','active'=>true];
        $this->internal('PUT','person-positions',['version'=>0,'items'=>$items],$this->p)->assertOk();
        $this->internal('GET','persons',['position_code'=>'president'],$this->p)->assertOk()->assertJsonPath('data.total',1)->assertJsonPath('data.items.0.id',$id)->assertJsonPath('data.items.0.position_label','Presidente');
        $other=array_replace($this->p,['organization_id'=>'33333333-3333-4333-8333-333333333333']);
        $this->internal('GET','persons',['position_code'=>'vocal-local'],$other)->assertUnprocessable();
        foreach ([['gender'=>'invalid'],['document_type'=>'XX'],['descriptive_role'=>'superadmin'],['position_code'=>'unknown'],['position_code'=>'0'],['position_code'=>"x' OR 1=1"],['gender'=>['female']]] as $invalid) {
            $this->internal('GET','persons',$invalid,$this->p)->assertUnprocessable();
        }
        $this->internal('GET','persons',['gender'=>'','document_type'=>'','descriptive_role'=>'','position_code'=>''], $this->p)->assertOk()->assertJsonPath('data.total',1);
    }
}
