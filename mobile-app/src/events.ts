import type { RealtimeEvent } from './types';

type Listener = (event: RealtimeEvent) => void;

const invoiceCreatedListeners = new Set<Listener>();

export function onInvoiceCreated(listener: Listener) {
  invoiceCreatedListeners.add(listener);
  return () => {
    invoiceCreatedListeners.delete(listener);
  };
}

export function emitInvoiceCreated(event: RealtimeEvent) {
  invoiceCreatedListeners.forEach((listener) => listener(event));
}
