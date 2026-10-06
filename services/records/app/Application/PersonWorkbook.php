<?php

namespace App\Application;

final class PersonWorkbook
{
    private static function xml(string $value): string
    {
        $safe = preg_replace('/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}\x{10000}-\x{10FFFF}]/u', '', $value);
        return htmlspecialchars($safe ?? '', ENT_XML1 | ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function row(array $values, int $number): string
    {
        $cells = '';
        foreach ($values as $index => $value) {
            // Every cell is text, including numeric codes and formula-looking names.
            $column = chr(65 + $index);
            $cells .= '<c r="'.$column.$number.'" t="inlineStr"><is><t xml:space="preserve">'.self::xml((string) ($value ?? '')).'</t></is></c>';
        }
        return '<row r="'.$number.'">'.$cells.'</row>';
    }

    public static function table(iterable $persons): array
    {
        $headers = [
            'N.º', 'Nombres', 'Apellidos', 'Tipo de documento', 'Número de documento',
            'Estado', 'Afiliación', 'Zona', 'Fecha de nacimiento', 'Cargo', 'Registro UTC', 'ID',
        ];
        $rows = [];
        $number = 1;
        foreach ($persons as $person) {
            $rows[] = array_map(fn ($value) => (string) ($value ?? ''), [
                $number++, $person->first_names, $person->last_names,
                ['RC' => 'Registro Civil', 'TI' => 'Tarjeta de Identidad', 'CC' => 'Cédula de Ciudadanía',
                    'CE' => 'Cédula de Extranjería', 'NIT' => 'NIT'][$person->document_type] ?? $person->document_type,
                $person->document_number, $person->status === 'complete' ? 'Completado' : 'Pendiente',
                $person->affiliated === null ? 'Sin dato' : ((int) $person->affiliated === 1 ? 'Sí' : 'No'),
                ['rural' => 'Rural', 'urban' => 'Urbana'][$person->zone] ?? '',
                $person->birth_date, $person->position_label, $person->created_at, $person->id,
            ]);
        }
        return ['headers' => $headers, 'rows' => $rows];
    }

    public static function create(iterable $persons): string
    {
        $table = self::table($persons);
        $rows = self::row($table['headers'], 1);
        foreach ($table['rows'] as $index => $values) {
            $rows .= self::row($values, $index + 2);
        }
        return self::pack($rows);
    }

    public static function individual(array $person, array $additional): string
    {
        $table = self::individualTable($person, $additional);
        $rows = self::row($table['headers'], 1);
        foreach ($table['rows'] as $index => $values) $rows .= self::row($values, $index + 2);
        return self::pack($rows, true);
    }

    public static function individualTable(array $person, array $additional): array
    {
        $labels = ['id' => 'ID', 'organization_id' => 'Junta ID', 'first_names' => 'Nombres',
            'last_names' => 'Apellidos', 'document_type' => 'Tipo de documento', 'document_number' => 'Número de documento',
            'status' => 'Estado', 'affiliated' => 'Afiliación', 'zone' => 'Zona', 'gender' => 'Género',
            'birth_date' => 'Fecha de nacimiento', 'phone' => 'Teléfono', 'email' => 'Correo electrónico',
            'position_label' => 'Cargo', 'descriptive_role' => 'Rol descriptivo', 'property_name' => 'Predio',
            'address' => 'Dirección', 'neighborhood' => 'Barrio', 'version' => 'Versión',
            'created_at' => 'Registro UTC', 'updated_at' => 'Actualización UTC'];
        $maps = ['document_type' => ['RC' => 'Registro Civil', 'TI' => 'Tarjeta de Identidad', 'CC' => 'Cédula de Ciudadanía', 'CE' => 'Cédula de Extranjería', 'NIT' => 'NIT'],
            'status' => ['pending' => 'Pendiente', 'complete' => 'Completado'], 'zone' => ['urban' => 'Urbana', 'rural' => 'Rural'],
            'gender' => ['male' => 'Masculino', 'female' => 'Femenino', 'other' => 'Otro'],
            'descriptive_role' => ['admin' => 'Administrador', 'registrar' => 'Registrador', 'treasurer' => 'Tesorero', 'auditor' => 'Auditor', 'viewer' => 'Consultor']];
        $rows = [];
        foreach ($labels as $key => $label) {
            $value = $person[$key] ?? '';
            if ($key === 'affiliated') $value = $value === '' ? 'Sin dato' : ((int) $value === 1 ? 'Sí' : 'No');
            else $value = $maps[$key][$value] ?? $value;
            $rows[] = [$label, (string) $value];
        }
        foreach ($additional as $field) {
            $rows[] = ['Campo adicional: '.$field['label'], (string) $field['display']];
        }
        return ['headers' => ['Campo', 'Valor'], 'rows' => $rows];
    }

    private static function pack(string $rows, bool $individual = false): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        $columns = $individual ? '<cols><col min="1" max="1" width="35" customWidth="1"/><col min="2" max="2" width="95" customWidth="1"/></cols>' : '';
        $sheet = $xml.'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'.$columns.'<sheetData>'.$rows.'</sheetData></worksheet>';
        $files = [
            '[Content_Types].xml' => $xml.'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
            '_rels/.rels' => $xml.'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
            'xl/workbook.xml' => $xml.'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Personas" sheetId="1" r:id="rId1"/></sheets></workbook>',
            'xl/_rels/workbook.xml.rels' => $xml.'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
            'xl/worksheets/sheet1.xml' => $sheet,
        ];
        $body = '';
        $directory = '';
        $offset = 0;
        foreach ($files as $name => $content) {
            $length = strlen($content);
            $crc = crc32($content);
            $local = pack('VvvvvvVVVvv', 0x04034b50, 20, 0, 0, 0, 0, $crc, $length, $length, strlen($name), 0).$name.$content;
            $directory .= pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0, 0, 0, 0, $crc, $length, $length, strlen($name), 0, 0, 0, 0, 0, $offset).$name;
            $body .= $local;
            $offset += strlen($local);
        }
        return $body.$directory.pack('VvvvvVVv', 0x06054b50, 0, 0, count($files), count($files), strlen($directory), $offset, 0);
    }
}
