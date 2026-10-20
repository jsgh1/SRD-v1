import { t } from './i18n';

export function pdfLogoBlock(logoData: string | null | undefined) {
  if (!logoData) return [];
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(logoData)) {
    throw new Error(t('El logo de la junta no tiene un formato PNG válido.'));
  }
  return [{ image: logoData, fit: [54, 54], margin: [0, 0, 0, 10] }];
}
