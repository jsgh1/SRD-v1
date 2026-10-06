export const planillaColumns = [
  ['email', 'Correo electrónico'], ['phone', 'Teléfono'],
  ['property_name', 'Nombre del predio'], ['zone', 'Zona'],
  ['position_label', 'Cargo'], ['descriptive_role', 'Rol descriptivo'],
  ['status', 'Estado del registro'], ['affiliated', 'Afiliado'],
] as const;

export type PlanillaConfiguration = {
  version: number;
  allowed_columns: string[];
  h1: string;
  h2: string;
  h3: string;
  delegated_roles: string[];
  can_manage: boolean;
  can_delegate: boolean;
};
