<?php

namespace App\Application;

final class PlanillaWorkbook
{
    private const LABELS = [
        'email' => 'Correo electrónico', 'phone' => 'Teléfono',
        'property_name' => 'Nombre del predio', 'zone' => 'Zona',
        'position_label' => 'Cargo', 'descriptive_role' => 'Rol descriptivo',
        'status' => 'Estado del registro', 'affiliated' => 'Afiliado',
    ];

    private static function xml(string $value): string
    {
        $safe = preg_replace('/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}\x{10000}-\x{10FFFF}]/u', '', $value);
        return htmlspecialchars($safe ?? '', ENT_XML1 | ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function row(array $values, int $number): string
    {
        $cells = '';
        foreach ($values as $index => $value) {
            $column = chr(65 + $index);
            $cells .= '<c r="'.$column.$number.'" t="inlineStr"><is><t xml:space="preserve">'.self::xml((string) ($value ?? '')).'</t></is></c>';
        }
        return '<row r="'.$number.'">'.$cells.'</row>';
    }

    private static function value(object $person, string $column): string
    {
        return match ($column) {
            'zone' => ['rural' => 'Rural', 'urban' => 'Urbana'][$person->zone] ?? '',
            'status' => $person->status === 'complete' ? 'Completado' : 'Pendiente',
            'affiliated' => $person->affiliated === null ? 'Sin dato' : ((int) $person->affiliated === 1 ? 'Sí' : 'No'),
            'descriptive_role' => ['admin' => 'Administrador', 'registrar' => 'Registrador',
                'treasurer' => 'Tesorero', 'auditor' => 'Auditor', 'viewer' => 'Consultor'][$person->descriptive_role] ?? '',
            default => (string) ($person->{$column} ?? ''),
        };
    }

    public static function table(iterable $persons, array $columns): array
    {
        $header = [
            'N.º', 'Nombres y apellidos', 'Tipo de documento', 'Número de documento',
            ...array_map(fn ($key) => self::LABELS[$key], $columns), 'Firma',
        ];
        $data = [];
        foreach ($persons as $person) {
            $values = [
                (string) (count($data) + 1), trim($person->first_names.' '.($person->last_names ?? '')),
                ['RC' => 'Registro Civil', 'TI' => 'Tarjeta de Identidad',
                    'CC' => 'Cédula de Ciudadanía', 'CE' => 'Cédula de Extranjería',
                    'NIT' => 'NIT'][$person->document_type] ?? $person->document_type,
                $person->document_number,
            ];
            foreach ($columns as $column) $values[] = self::value($person, $column);
            $values[] = ''; // The signature column is always empty and last.
            $data[] = $values;
        }
        return ['headers' => $header, 'rows' => $data];
    }

    public static function create(iterable $persons, array $columns, array $headings): string
    {
        $date = now('America/Bogota');
        $table = self::table($persons, $columns);
        $rows = self::row([$headings['h1']], 1)
            .self::row([$headings['h2']], 2)
            .self::row(['MES: '.$date->format('m').'     DÍA: '.$date->format('d').'     AÑO: '.$date->format('Y')], 3)
            .self::row([$headings['h3']], 4)
            .self::row([], 5)
            .self::row($table['headers'], 6);
        $number = 7;
        foreach ($table['rows'] as $values) $rows .= self::row($values, $number++);
        $rows .= self::row([], $number++);
        $rows .= self::row(['________________________', '________________________'], $number++);
        $rows .= self::row(['PRESIDENTE', 'SECRETARIO'], $number);
        $last = chr(64 + count($table['headers']));
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        $sheet = $xml.'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
            .'<cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="2" width="32" customWidth="1"/>'
            .'<col min="3" max="'.$last.'" width="22" customWidth="1"/></cols>'
            .'<sheetData>'.$rows.'</sheetData>'
            .'<mergeCells count="4"><mergeCell ref="A1:'.$last.'1"/><mergeCell ref="A2:'.$last.'2"/>'
            .'<mergeCell ref="A3:'.$last.'3"/><mergeCell ref="A4:'.$last.'4"/></mergeCells>'
            .'<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0" footer="0"/>'
            .'<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
        $files = [
            '[Content_Types].xml' => $xml.'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
            '_rels/.rels' => $xml.'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
            'xl/workbook.xml' => $xml.'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Planilla" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">Planilla!$1:$6</definedName></definedNames></workbook>',
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
