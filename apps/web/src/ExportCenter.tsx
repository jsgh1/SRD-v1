import { ArrowUpRight, ClipboardList, FileSpreadsheet, Package, Users, Wallet } from 'lucide-react';
import type { Principal } from './api';
import { t, useLanguage } from './i18n';

type Destination = 'list' | 'treasury' | 'inventory' | 'audit';

export function ExportCenter({ principal, onOpen }: {
  principal: Principal;
  onOpen: (destination: Destination) => void;
}) {
  useLanguage();
  const financial = ['superadmin', 'admin', 'treasurer'].includes(principal.role);
  const audit = ['superadmin', 'admin', 'auditor'].includes(principal.role);
  const modules = [
    {
      key: 'persons', destination: 'list' as const, icon: Users,
      title: 'Personas y planilla de firmas',
      description: 'Filtra los registros y descarga el listado, una ficha individual o la planilla de firmas en PDF o Excel.',
      action: 'Abrir exportación de personas',
    },
    ...(financial ? [
      {
        key: 'treasury', destination: 'treasury' as const, icon: Wallet,
        title: 'Tesorería',
        description: 'Filtra el historial por fechas y concepto; descarga el historial o un comprobante en PDF o Excel.',
        action: 'Abrir exportación de tesorería',
      },
      {
        key: 'inventory', destination: 'inventory' as const, icon: Package,
        title: 'Inventario',
        description: 'Filtra bienes y movimientos; descarga los listados y el historial en PDF o Excel.',
        action: 'Abrir exportación de inventario',
      },
    ] : []),
    ...(audit ? [{
      key: 'audit', destination: 'audit' as const, icon: ClipboardList,
      title: 'Auditoría',
      description: 'Filtra la bitácora por fecha, actor, módulo y resultado; descarga el historial en PDF o Excel.',
      action: 'Abrir exportación de auditoría',
    }] : []),
  ];

  return <>
    <div className="page-heading">
      <div>
        <h1>{t('Exportar')}</h1>
        <p className="muted">{t('Elige qué información de tu junta necesitas descargar.')}</p>
      </div>
    </div>
    <section className="export-center" aria-label={t('Áreas disponibles para exportar')}>
      {modules.map(({ key, destination, icon: Icon, title, description, action }) =>
        <article className="panel export-center-card" key={key}>
          <span className="export-center-icon" aria-hidden="true"><Icon size={21} /></span>
          <div>
            <h2>{t(title)}</h2>
            <p className="muted">{t(description)}</p>
          </div>
          <button type="button" onClick={() => onOpen(destination)}>
            {t(action)} <ArrowUpRight size={17} aria-hidden="true" />
          </button>
        </article>
      )}
    </section>
    <p className="muted export-center-note"><FileSpreadsheet size={17} aria-hidden="true" /> {t('Cada área conserva sus filtros, permisos y confirmación del nombre del archivo.')}</p>
  </>;
}
