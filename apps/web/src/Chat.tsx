import { useEffect, useRef, useState, type FormEvent } from 'react';
import Pusher from 'pusher-js';
import { ApiError, api } from './api';
import { Empty, ErrorBox, Loading } from './ui';

type Conversation = { id: string; contact: { id: string; name: string }; updated_at: string };
type ConversationPage = { items: Conversation[]; page: number; page_size: number; total: number };
type Message = { id: string; sequence: number; sender_id: string; body: string; created_at: string; delivered_at: string | null; read_at: string | null };
type History = { items: Message[]; next_before: number | null; next_after: number | null; receipts: Pick<Message, 'id' | 'delivered_at' | 'read_at'>[] };
type Receipt = { items: Pick<Message, 'id' | 'delivered_at' | 'read_at'>[] };

function withReceipt(message: Message, receipt?: Receipt['items'][number]): Message {
  return receipt ? { ...message, delivered_at: message.delivered_at ?? receipt.delivered_at, read_at: message.read_at ?? receipt.read_at } : message;
}

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map(message => [message.id, message]));
  for (const message of incoming) {
    const previous = byId.get(message.id);
    byId.set(message.id, previous ? withReceipt({ ...previous, ...message }, previous) : message);
  }
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}

function mergeReceipts(current: Message[], receipts: History['receipts']): Message[] {
  const byId = new Map(receipts.map(receipt => [receipt.id, receipt]));
  return current.map(message => withReceipt(message, byId.get(message.id)));
}

function reportAuthorizationLoss(error: unknown) {
  if (error instanceof ApiError && [401, 403].includes(error.status)) {
    document.dispatchEvent(new Event('srd-chat-auth-lost'));
  }
}

export function Chat({ userId, conversationId, onStarted, onOpened, selfId, onContacts }: { userId?: string; conversationId?: string; onStarted: () => void; onOpened: () => void; selfId: string; onContacts: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationPage, setConversationPage] = useState(1);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [conversationPageSize, setConversationPageSize] = useState(25);
  const [selected, setSelected] = useState<Conversation>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [pendingId, setPendingId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [refresh, setRefresh] = useState(0);
  const [visibilityTick, setVisibilityTick] = useState(0);
  const deliveredIds = useRef(new Set<string>());
  const readingIds = useRef(new Set<string>());
  const messagesRef = useRef<Message[]>([]);
  const latestSequence = useRef(0);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    let active = true;
    let socket: Pusher | undefined;
    let stopped = false;
    let connecting = false;
    let generation = 0;
    const disconnect = () => {
      generation++;
      connecting = false;
      socket?.disconnect();
      socket = undefined;
    };
    const stop = () => { stopped = true; disconnect(); };
    const connect = () => {
      if (!active || stopped || document.hidden || socket || connecting) return;
      connecting = true;
      const attempt = ++generation;
      void api<{ key: string; channel: string }>('chat/broadcast-config').then(value => {
        if (!active || stopped || document.hidden || attempt !== generation) return;
        const port = Number(window.location.port) || (window.location.protocol === 'https:' ? 443 : 80);
        socket = new Pusher(value.key, {
          cluster: 'mt1', wsHost: window.location.hostname, wsPort: port, wssPort: port,
          forceTLS: window.location.protocol === 'https:', enabledTransports: ['ws', 'wss'],
          channelAuthorization: { customHandler: (params, callback) => {
            void api<{ auth: string; channel_data: string }>('chat/broadcast-auth', 'POST', {
              socket_id: params.socketId, channel_name: params.channelName,
            }).then(auth => callback(null, auth)).catch(error => {
              if (active && attempt === generation) reportAuthorizationLoss(error);
              callback(error instanceof Error ? error : new Error('No se pudo autorizar Chat.'), null);
            });
          } },
        });
        socket.subscribe(value.channel).bind('chat.changed', () => {
          document.dispatchEvent(new Event('srd-chat-change'));
        });
      }).catch(error => { if (active && attempt === generation) reportAuthorizationLoss(error); /* El sondeo recupera la conexión indisponible. */ })
        .finally(() => { if (attempt === generation) connecting = false; });
    };
    const onVisibility = () => { if (document.hidden) disconnect(); else connect(); };
    document.addEventListener('srd-chat-auth-lost', stop);
    document.addEventListener('visibilitychange', onVisibility);
    connect();
    return () => {
      active = false;
      document.removeEventListener('srd-chat-auth-lost', stop);
      document.removeEventListener('visibilitychange', onVisibility);
      disconnect();
    };
  }, [selfId]);

  async function confirmDelivered(conversationId: string, fetched: Message[]) {
    const ids = fetched.filter(message => message.sender_id !== selfId && !message.delivered_at && !deliveredIds.current.has(message.id)).map(message => message.id);
    if (!ids.length) return;
    ids.forEach(id => deliveredIds.current.add(id));
    try {
      const value = await api<Receipt>(`conversations/${conversationId}/receipts`, 'POST', { kind: 'delivered', message_ids: ids });
      setMessages(current => current.map(message => {
        const receipt = value.items.find(item => item.id === message.id);
        return withReceipt(message, receipt);
      }));
    } catch {
      ids.forEach(id => deliveredIds.current.delete(id));
    }
  }

  useEffect(() => {
    let active = true;
    let running = false;
    let stopped = false;
    const load = async () => {
      if (document.hidden || running || stopped) return;
      running = true;
      try {
        const value = await api<ConversationPage>(`conversations?page=${conversationPage}`);
        if (active) {
          const lastPage = Math.max(1, Math.ceil(value.total / value.page_size));
          if (conversationPage > lastPage) { setConversationPage(lastPage); return; }
          setConversations(value.items); setConversationTotal(value.total);
          setConversationPageSize(value.page_size); setLoading(false); setError(undefined);
        }
      } catch (value) {
        if (active) { setError(value); setLoading(false); }
        if (active && value instanceof ApiError && [401, 403].includes(value.status)) { stopped = true; reportAuthorizationLoss(value); }
      } finally { running = false; }
    };
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    document.addEventListener('visibilitychange', load);
    document.addEventListener('srd-chat-change', load);
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange', load); document.removeEventListener('srd-chat-change', load); };
  }, [conversationPage, refresh]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setBusy(true);
    void api<Conversation>('conversations', 'POST', { user_id: userId }).then(value => {
      if (active) { setSelected(value); setConversationPage(1); setConversations(current => [value, ...current.filter(item => item.id !== value.id)]); setRefresh(current => current + 1); setError(undefined); onStarted(); }
    }).catch(value => { if (active) setError(value); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [userId, onStarted]);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    void api<Conversation>(`conversations/${conversationId}`).then(value => {
      if (active) { setSelected(value); setConversationPage(1); setConversations(current => [value, ...current.filter(item => item.id !== value.id)]); setRefresh(current => current + 1); setError(undefined); onOpened(); }
    }).catch(value => { if (active) setError(value); });
    return () => { active = false; };
  }, [conversationId, onOpened]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    let running = false;
    let initialized = false;
    let stopped = false;
    deliveredIds.current.clear(); readingIds.current.clear();
    messagesRef.current = []; latestSequence.current = 0;
    setMessages([]); setBefore(null);
    const load = async () => {
      if (document.hidden || running || stopped) return;
      running = true;
      try {
        if (!initialized) {
          const value = await api<History>(`conversations/${selected.id}/messages`);
          if (!active) return;
          setMessages(current => mergeMessages(current, value.items));
          setBefore(value.next_before);
          latestSequence.current = Math.max(latestSequence.current, value.items.at(-1)?.sequence ?? 0);
          initialized = true;
          void confirmDelivered(selected.id, value.items);
        } else {
          const receiptIds = messagesRef.current.filter(message => message.sender_id === selfId).slice(-25).map(message => message.id);
          for (let page = 0; page < 4; page++) {
            const query = new URLSearchParams({ after: String(latestSequence.current) });
            receiptIds.forEach((id, index) => query.append(`receipt_ids[${index}]`, id));
            const value = await api<History>(`conversations/${selected.id}/messages?${query}`);
            if (!active) return;
            setMessages(current => mergeReceipts(mergeMessages(current, value.items), value.receipts));
            latestSequence.current = Math.max(latestSequence.current, value.items.at(-1)?.sequence ?? 0);
            void confirmDelivered(selected.id, value.items);
            if (value.next_after === null) break;
          }
        }
        setError(undefined);
      } catch (value) {
        if (active) setError(value);
        if (active && value instanceof ApiError && [401, 403].includes(value.status)) { stopped = true; reportAuthorizationLoss(value); }
      }
      finally { running = false; }
    };
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    document.addEventListener('visibilitychange', load);
    document.addEventListener('srd-chat-change', load);
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange', load); document.removeEventListener('srd-chat-change', load); };
  }, [selected?.id]);

  useEffect(() => {
    const onVisibility = () => setVisibilityTick(value => value + 1);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!selected || document.hidden) return;
    const conversationId = selected.id;
    const observer = new IntersectionObserver(entries => {
      if (document.hidden) return;
      const ids = entries.filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)
        .map(entry => (entry.target as HTMLElement).dataset.messageId).filter((id): id is string => !!id && !readingIds.current.has(id));
      if (!ids.length) return;
      for (let index = 0; index < ids.length; index += 25) {
        const batch = ids.slice(index, index + 25);
        batch.forEach(id => readingIds.current.add(id));
        void api<Receipt>(`conversations/${conversationId}/receipts`, 'POST', { kind: 'read', message_ids: batch })
          .then(value => setMessages(current => mergeReceipts(current, value.items)))
          .catch(() => batch.forEach(id => readingIds.current.delete(id)));
      }
    }, { threshold: 0.5 });
    document.querySelectorAll<HTMLLIElement>('.chat-messages li[data-message-id]').forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [selected?.id, messages, visibilityTick]);

  async function older() {
    if (!selected || !before) return;
    try {
      const value = await api<History>(`conversations/${selected.id}/messages?before=${before}`);
      setMessages(current => mergeMessages(current, value.items)); setBefore(value.next_before); setError(undefined);
      void confirmDelivered(selected.id, value.items);
    } catch (value) { setError(value); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selected || !body.trim() || busy) return;
    const clientId = pendingId ?? crypto.randomUUID();
    setPendingId(clientId); setBusy(true);
    try {
      const value = await api<Message>(`conversations/${selected.id}/messages`, 'POST', { client_id: clientId, body });
      setMessages(current => mergeMessages(current, [value]));
      setBody(''); setPendingId(undefined); setError(undefined); setRefresh(value => value + 1);
    } catch (value) { setError(value); }
    finally { setBusy(false); }
  }

  return <>
    <div className="page-heading"><div><h1>Chat de la junta</h1><p className="muted">Conversaciones privadas entre cuentas de la junta activa.</p></div><button type="button" onClick={onContacts}>Buscar contacto</button></div>
    <ErrorBox error={error} />
    <div className="chat-layout">
      <section className="panel" aria-label="Conversaciones"><h2>Conversaciones</h2>{loading ? <Loading /> : conversations.length ? <ul className="chat-conversations">{conversations.map(item => <li key={item.id}><button type="button" aria-current={selected?.id === item.id ? 'true' : undefined} onClick={() => { setSelected(item); setError(undefined); }}>{item.contact.name}</button></li>)}</ul> : <Empty title="Sin conversaciones">Busca un contacto para iniciar una conversación.</Empty>}{conversationTotal > conversationPageSize && <div className="actions"><button type="button" disabled={loading || conversationPage <= 1} onClick={() => { setLoading(true); setConversationPage(page => page - 1); }}>Conversaciones anteriores</button><span>Página {conversationPage} de {Math.ceil(conversationTotal / conversationPageSize)}</span><button type="button" disabled={loading || conversationPage * conversationPageSize >= conversationTotal} onClick={() => { setLoading(true); setConversationPage(page => page + 1); }}>Conversaciones siguientes</button></div>}</section>
      <section className="panel" aria-label="Mensajes">{selected ? <><h2>{selected.contact.name}</h2><p className="muted">Los mensajes se conservan en la junta. Se actualizan al recibir cambios y se comprueban cada 15 segundos mientras esta página esté visible.</p>{before && <button type="button" onClick={() => void older()}>Ver mensajes anteriores</button>}<ol className="chat-messages">{messages.map(message => <li key={message.id} data-message-id={message.sender_id !== selfId && !message.read_at ? message.id : undefined} className={message.sender_id === selfId ? 'mine' : ''}><strong>{message.sender_id === selfId ? 'Tú' : selected.contact.name}</strong><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString('es-CO')} · {message.sender_id === selfId ? message.read_at ? 'Leído' : message.delivered_at ? 'Entregado' : 'Enviado' : 'Recibido'}</small></li>)}</ol><form onSubmit={send}><label>Mensaje<textarea maxLength={10000} rows={3} value={body} onChange={event => { if (event.target.value !== body) setPendingId(undefined); setBody(event.target.value); }} /></label><button className="primary" disabled={busy || !body.trim()}>{busy ? 'Enviando…' : 'Enviar'}</button></form></> : <Empty title="Selecciona una conversación">Elige una conversación o busca un contacto.</Empty>}</section>
    </div>
  </>;
}
