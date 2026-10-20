import { useEffect, useState } from 'react';
import { Modal } from './ui';
import { t } from './i18n';

type Confirmation = { message: string; resolve: (accepted: boolean) => void };
const eventName = 'srd-confirm-action';

export function confirmInApp(message: string): Promise<boolean> {
  return new Promise(resolve => window.dispatchEvent(new CustomEvent<Confirmation>(eventName, { detail: { message, resolve } })));
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Confirmation>();
  useEffect(() => {
    const receive = (event: Event) => setPending((event as CustomEvent<Confirmation>).detail);
    window.addEventListener(eventName, receive);
    return () => window.removeEventListener(eventName, receive);
  }, []);
  function finish(accepted: boolean) {
    pending?.resolve(accepted);
    setPending(undefined);
  }
  return pending ? <Modal title={t('Confirmar acción')} onClose={() => finish(false)}>
    <p>{pending.message}</p>
    <div className="actions end">
      <button type="button" autoFocus onClick={() => finish(false)}>{t('Cancelar')}</button>
      <button type="button" className="primary" onClick={() => finish(true)}>{t('Confirmar')}</button>
    </div>
  </Modal> : null;
}
