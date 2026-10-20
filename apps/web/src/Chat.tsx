import { useEffect, useRef, useState, type FormEvent } from 'react';
import Pusher from 'pusher-js';
import { ApiError, api } from './api';
import { Empty, ErrorBox, Loading } from './ui';
import { formatLocale, localizedLabel, t, useLanguage } from './i18n';
import { ContactAvatar } from './ContactAvatar';
import { recordedBlobToWav } from './voiceNote';
import { Check, ChevronDown, ChevronUp, Download, Eye, FileText, Image as ImageIcon, Mic, Pause, Paperclip, Phone, Pin, Play, Reply, Search, Send, Trash2, Volume2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Modal } from './ui';

type Conversation = { id: string; contact: { id: string; name: string }; contact_activity?: 'typing' | 'recording' | 'calling' | null; updated_at: string };
type ConversationPage = { items: Conversation[]; page: number; page_size: number; total: number };
type ChatAttachment = { id: string; name: string; mime: string; bytes: number };
type Message = { id: string; sequence: number; sender_id: string; body: string; attachment: ChatAttachment | null; reply_to_id: string | null; pinned: boolean; system_kind?: 'call_missed' | 'call_ended' | null; call_duration_seconds?: number | null; created_at: string; delivered_at: string | null; read_at: string | null };
type History = { items: Message[]; next_before: number | null; next_after: number | null; removed_ids?: string[]; receipts: Pick<Message, 'id' | 'delivered_at' | 'read_at'>[] };
type Receipt = { items: Pick<Message, 'id' | 'delivered_at' | 'read_at'>[] };
const presenceLabels: Record<string, string> = { online: 'En línea', away: 'Ausente', dnd: 'No molestar', invisible: 'Desconectado', offline: 'Desconectado' };
const activityLabels: Record<string, string> = { typing: 'Escribiendo…', recording: 'Grabando una nota de voz…', calling: 'Llamando…' };
const clockLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function VoiceNotePlayer({ src, onRequest, loading, label }: {src?: string; onRequest?: () => void; loading?: boolean; label: string}) {
  const audio = useRef<HTMLAudioElement>(null);
  const requested = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    setPlaying(false); setCurrent(0); setDuration(0);
    if (src && requested.current) { requested.current = false; void audio.current?.play().catch(() => undefined); }
  }, [src]);
  function toggle() {
    if (!src) { requested.current = true; onRequest?.(); return; }
    if (!audio.current) return;
    if (audio.current.paused) void audio.current.play().catch(() => undefined);
    else audio.current.pause();
  }
  return <div className="chat-voice-player"><audio ref={audio} src={src} preload="metadata" aria-label={label}
    onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
    onTimeUpdate={event => setCurrent(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    <button type="button" className="chat-voice-toggle" disabled={loading} onClick={toggle} aria-label={t(playing ? 'Pausar nota de voz' : 'Reproducir nota de voz')}>{playing ? <Pause size={19} /> : <Play size={19} />}</button>
    <span className="chat-voice-times">{clockLabel(Math.floor(current))}/{clockLabel(Math.floor(duration))}</span>
    <div className="chat-voice-timeline"><span aria-hidden="true">{[4,9,14,6,18,11,5,20,12,7,16,10,4,13,19,6,12,8,17,5,15,10,6,12].map((height, index) => <i key={index} className={duration && index / 24 <= current / duration ? 'played' : ''} style={{height}} />)}</span><input type="range" min="0" max={duration || 1} step="0.1" value={Math.min(current, duration || 0)} disabled={!src || !duration} aria-label={t('Avanzar nota de voz')} onChange={event => { if (audio.current) { audio.current.currentTime = Number(event.target.value); setCurrent(audio.current.currentTime); } }} /></div>
    <label className="chat-voice-volume" title={t('Volumen de la nota de voz')}><Volume2 size={17} /><input type="range" min="0" max="1" step="0.05" defaultValue="1" aria-label={t('Volumen de la nota de voz')} onChange={event => { if (audio.current) audio.current.volume = Number(event.target.value); }} /></label>
  </div>;
}

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

export function Chat({ userId, conversationId, onStarted, onOpened, selfId, organizationId, onContacts, onVoiceSelection }: { userId?: string; conversationId?: string; onStarted: () => void; onOpened: () => void; selfId: string; organizationId: string; onContacts: () => void; onVoiceSelection: (value?: { id: string; name: string }) => void }) {
  useLanguage();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationPage, setConversationPage] = useState(1);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [conversationPageSize, setConversationPageSize] = useState(25);
  const [selected, setSelected] = useState<Conversation>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File>();
  const [filePreview, setFilePreview] = useState<string>();
  const [filePreviewError, setFilePreviewError] = useState(false);
  const [audioPlayback, setAudioPlayback] = useState<{ messageId: string; url: string }>();
  const [recording, setRecording] = useState(false);
  const [recordPaused, setRecordPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(() => Array(28).fill(0));
  const [processingAudio, setProcessingAudio] = useState(false);
  const [downloading, setDownloading] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversationError, setConversationError] = useState(false);
  const [messageError, setMessageError] = useState<unknown>();
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [sendError, setSendError] = useState<unknown>();
  const [refresh, setRefresh] = useState(0);
  const [visibilityTick, setVisibilityTick] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>();
  const [searchBusy, setSearchBusy] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [imageViewer, setImageViewer] = useState<Message>();
  const [imageZoom, setImageZoom] = useState(1);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(() => new Set());
  const [contactOpen, setContactOpen] = useState(false);
  const [contactDetails, setContactDetails] = useState<{name?: string; presence?: string; title?: string | null; title_en?: string | null}>();
  const [contactPresences, setContactPresences] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Message>();
  const [removeMessage, setRemoveMessage] = useState<Message>();
  const [clearOpen, setClearOpen] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const imageUrlsRef = useRef<Record<string, string>>({});
  const imageLoadingRef = useRef(new Set<string>());
  const deliveredIds = useRef(new Set<string>());
  const readingIds = useRef(new Set<string>());
  const messagesRef = useRef<Message[]>([]);
  const latestSequence = useRef(0);
  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const recordTimeoutRef = useRef<number | undefined>(undefined);
  const recordIntervalRef = useRef<number | undefined>(undefined);
  const waveIntervalRef = useRef<number | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const recordStartedRef = useRef(0);
  const pausedAtRef = useRef(0);
  const pauseDurationRef = useRef(0);
  const recordGenerationRef = useRef(0);
  const draftGenerationRef = useRef(0);
  const requestingMicRef = useRef(false);
  const selectedIdRef = useRef(selected?.id);
  selectedIdRef.current = selected?.id;

  useEffect(() => {
    onVoiceSelection(undefined);
    return () => onVoiceSelection(undefined);
  }, []);

  function selectConversation(value: Conversation) {
    if (selectedIdRef.current === value.id) return;
    if (selectedIdRef.current) void api(`conversations/${selectedIdRef.current}/activity`, 'POST', {kind: 'idle'}).catch(() => undefined);
    draftGenerationRef.current++;
    selectedIdRef.current = value.id;
    setSelected(value);
    onVoiceSelection({ id: value.id, name: value.contact.name });
    setBody(''); setFile(undefined); setPendingId(undefined); setError(undefined); setSendError(undefined);
    setReplyTo(undefined); setSearchOpen(false); setSearchResults(undefined); setSearchTerm(''); setPinnedMessages([]);
    setImageViewer(undefined); setContactOpen(false); setExpandedMessages(new Set());
  }

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const outgoingActivity = recording ? 'recording' : body.trim() ? 'typing' : 'idle';
  useEffect(() => { if (!body && bodyInputRef.current) bodyInputRef.current.style.height = 'auto'; }, [body]);
  useEffect(() => {
    const id = selected?.id;
    if (!id) return;
    const sendActivity = () => { if (!document.hidden) void api(`conversations/${id}/activity`, 'POST', {kind: outgoingActivity}).catch(() => undefined); };
    sendActivity();
    if (outgoingActivity === 'idle') return;
    const interval = window.setInterval(sendActivity, 3000);
    return () => clearInterval(interval);
  }, [selected?.id, outgoingActivity]);
  const selectedActivity = conversations.find(item => item.id === selected?.id)?.contact_activity || selected?.contact_activity;
  useEffect(() => {
    setFilePreview(undefined);
    setFilePreviewError(false);
    const image = !!file && (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name));
    const audio = !!file && (file.type.startsWith('audio/') || /\.(wav|mp3)$/i.test(file.name));
    if (!file || (!image && !audio)) { setFilePreview(undefined); return; }
    if (image) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(String(reader.result));
      reader.onerror = () => setFilePreview(undefined);
      reader.readAsDataURL(file);
      return () => { reader.onload = null; reader.onerror = null; if (reader.readyState === FileReader.LOADING) reader.abort(); };
    }
    const preview = file.type ? file : new Blob([file], { type: /\.mp3$/i.test(file.name) ? 'audio/mpeg'
      : audio ? 'audio/wav' : /\.jpe?g$/i.test(file.name) ? 'image/jpeg' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/png' });
    const url = URL.createObjectURL(preview);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => { if (audioPlayback) URL.revokeObjectURL(audioPlayback.url); }, [audioPlayback]);
  useEffect(() => {
    const conversation = selected?.id;
    if (!conversation) return;
    let active = true;
    setImagePreviews({});
    void api<{items: Message[]}>(`conversations/${conversation}/pinned`)
      .then(value => { if (active) setPinnedMessages(value.items); })
      .catch(value => { if (active) setError(value); });
    return () => {
      active = false;
      Object.values(imageUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
      imageUrlsRef.current = {};
      imageLoadingRef.current.clear();
      setImagePreviews({});
    };
  }, [selected?.id]);
  useEffect(() => {
    const contactId = selected?.contact.id;
    if (!contactId) { setContactDetails(undefined); return; }
    let active = true;
    const load = () => {
      void api<{name?: string; presence?: string; title?: string | null; title_en?: string | null}>(`contacts/${contactId}`)
        .then(value => { if (active) setContactDetails(value); })
        .catch(error => { if (active) reportAuthorizationLoss(error); });
    };
    load();
    const interval = window.setInterval(load, 30000);
    return () => { active = false; clearInterval(interval); };
  }, [selected?.contact.id, organizationId]);
  useEffect(() => {
    if (!conversations.length) return;
    let active = true;
    const load = async () => {
      const results = await Promise.allSettled(conversations.map(item => api<{presence?: string}>(`contacts/${item.contact.id}`)));
      if (!active) return;
      const next: Record<string, string> = {};
      results.forEach((result, index) => { if (result.status === 'fulfilled') next[conversations[index].contact.id] = result.value.presence || 'offline'; });
      setContactPresences(next);
    };
    void load();
    const interval = window.setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [conversations.map(item => item.contact.id).join(','), organizationId]);
  useEffect(() => {
    if (!selected) return;
    const conversation = selected.id;
    for (const message of messages) {
      if (!message.attachment?.mime.startsWith('image/') || imageUrlsRef.current[message.id] || imageLoadingRef.current.has(message.id)) continue;
      imageLoadingRef.current.add(message.id);
      void api<ChatAttachment & {content: string}>(`conversations/${conversation}/messages/${message.id}/attachment`)
        .then(result => {
          if (!result.mime.startsWith('image/')) return;
          const url = `data:${result.mime};base64,${result.content}`;
          if (selectedIdRef.current !== conversation) return;
          imageUrlsRef.current[message.id] = url;
          setImagePreviews(current => ({ ...current, [message.id]: url }));
        })
        .catch(() => undefined)
        .finally(() => imageLoadingRef.current.delete(message.id));
    }
  }, [selected?.id, messages]);
  useEffect(() => {
    setAudioPlayback(undefined); setRecording(false); setProcessingAudio(false);
    return () => {
      recordGenerationRef.current++;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
      clearTimeout(recordTimeoutRef.current);
      clearInterval(recordIntervalRef.current);
      clearInterval(waveIntervalRef.current);
      void audioContextRef.current?.close(); audioContextRef.current = undefined;
      recorderRef.current = undefined; streamRef.current = undefined;
    };
  }, [selected?.id]);

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
          setConversations(value.items); setConversationTotal(value.total); setConversationError(false);
          setConversationPageSize(value.page_size); setLoading(false); setError(undefined);
        }
      } catch (value) {
        if (active) { setError(value); setConversations([]); setConversationTotal(0); setConversationError(true); setLoading(false); }
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
      if (active) { selectConversation(value); setConversationPage(1); setConversations(current => [value, ...current.filter(item => item.id !== value.id)]); setRefresh(current => current + 1); onStarted(); }
    }).catch(value => { if (active) setError(value); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [userId, onStarted]);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    void api<Conversation>(`conversations/${conversationId}`).then(value => {
      if (active) { selectConversation(value); setConversationPage(1); setConversations(current => [value, ...current.filter(item => item.id !== value.id)]); setRefresh(current => current + 1); onOpened(); }
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
    setMessageError(undefined); setMessageLoading(true);
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
          setMessageLoading(false);
          void confirmDelivered(selected.id, value.items);
        } else {
          const receiptIds = messagesRef.current.filter(message => message.sender_id === selfId).slice(-25).map(message => message.id);
          for (let page = 0; page < 4; page++) {
            const query = new URLSearchParams({ after: String(latestSequence.current) });
            receiptIds.forEach((id, index) => query.append(`receipt_ids[${index}]`, id));
            if (page === 0) messagesRef.current.slice(-100).forEach((message, index) => query.append(`visible_ids[${index}]`, message.id));
            const value = await api<History>(`conversations/${selected.id}/messages?${query}`);
            if (!active) return;
            setMessages(current => mergeReceipts(mergeMessages(current.filter(item => !value.removed_ids?.includes(item.id)), value.items), value.receipts));
            if (value.removed_ids?.length) setPinnedMessages(current => current.filter(item => !value.removed_ids?.includes(item.id)));
            latestSequence.current = Math.max(latestSequence.current, value.items.at(-1)?.sequence ?? 0);
            void confirmDelivered(selected.id, value.items);
            if (value.next_after === null) break;
          }
        }
        setMessageError(undefined);
      } catch (value) {
        if (active) { setMessageError(value); setMessageLoading(false); }
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

  async function jumpToMessage(message: Message) {
    if (!selected) return;
    if (!messages.some(item => item.id === message.id)) {
      try {
        const value = await api<History>(`conversations/${selected.id}/messages?before=${message.sequence + 1}`);
        setMessages(current => mergeMessages(current, value.items));
      } catch (value) { setError(value); return; }
    }
    window.setTimeout(() => {
      const target = document.getElementById(`chat-message-${message.id}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.classList.add('chat-jump-highlight');
      window.setTimeout(() => target?.classList.remove('chat-jump-highlight'), 1800);
    }, 50);
  }

  function releaseMicrophone() {
    clearTimeout(recordTimeoutRef.current);
    clearInterval(recordIntervalRef.current);
    clearInterval(waveIntervalRef.current);
    void audioContextRef.current?.close(); audioContextRef.current = undefined;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = undefined;
    recorderRef.current = undefined;
    setRecording(false);
    setRecordPaused(false);
  }

  function toggleRecordPause() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') { recorder.pause(); pausedAtRef.current = Date.now(); setRecordPaused(true); }
    else if (recorder.state === 'paused') {
      pauseDurationRef.current += Date.now() - pausedAtRef.current;
      recorder.resume(); setRecordPaused(false);
    }
  }

  function stopRecording(discard = false) {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (discard) recorder.onstop = null;
    if (recorder.state !== 'inactive') recorder.stop();
    if (discard) releaseMicrophone();
  }

  useEffect(() => {
    const discardHiddenRecording = () => {
      if (!document.hidden || (!recorderRef.current && !requestingMicRef.current)) return;
      recordGenerationRef.current++;
      stopRecording(true);
      setProcessingAudio(false);
    };
    document.addEventListener('visibilitychange', discardHiddenRecording);
    return () => document.removeEventListener('visibilitychange', discardHiddenRecording);
  }, []);

  async function startRecording() {
    if (!selected || recording || processingAudio || busy || requestingMicRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(new Error(t('Este navegador no permite grabar notas de voz.'))); return;
    }
    requestingMicRef.current = true;
    const generation = recordGenerationRef.current;
    const conversation = selected.id;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if (generation !== recordGenerationRef.current || selectedIdRef.current !== conversation) {
        stream.getTracks().forEach(track => track.stop()); return;
      }
      const recorder = new MediaRecorder(stream);
      const parts: Blob[] = [];
      let recordedBytes = 0;
      recorder.ondataavailable = event => {
        if (!event.data.size) return;
        recordedBytes += event.data.size;
        if (recordedBytes > 10 * 1024 * 1024) {
          stopRecording(true);
          setError(new Error(t('La nota de voz supera el límite de 10 MB.')));
        } else parts.push(event.data);
      };
      recorder.onerror = () => {
        stopRecording(true);
        setError(new Error(t('No se pudo grabar la nota de voz.')));
      };
      recorder.onstop = () => {
        releaseMicrophone();
        if (generation !== recordGenerationRef.current || selectedIdRef.current !== conversation) return;
        setProcessingAudio(true);
        void recordedBlobToWav(new Blob(parts, { type: recorder.mimeType })).then(wav => {
          if (generation === recordGenerationRef.current && selectedIdRef.current === conversation) {
            setFile(wav); setPendingId(undefined); setError(undefined);
          }
        }).catch(() => {
          if (generation === recordGenerationRef.current) setError(new Error(t('No se pudo preparar la nota de voz.')));
        }).finally(() => { if (generation === recordGenerationRef.current) setProcessingAudio(false); });
      };
      recorderRef.current = recorder; streamRef.current = stream;
      setFile(undefined); setPendingId(undefined); setError(undefined); setRecordSeconds(0); setWaveform(Array(28).fill(0)); setRecordPaused(false);
      recorder.start(1000);
      setRecording(true);
      recordStartedRef.current = Date.now(); pauseDurationRef.current = 0; pausedAtRef.current = 0;
      recordIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordStartedRef.current - pauseDurationRef.current
          - (recorder.state === 'paused' ? Date.now() - pausedAtRef.current : 0)) / 1000);
        setRecordSeconds(elapsed);
        if (elapsed >= 120) stopRecording();
      }, 250);
      if (typeof AudioContext !== 'undefined') {
        try {
          const context = new AudioContext();
          audioContextRef.current = context;
          const source = context.createMediaStreamSource(stream);
          const analyser = context.createAnalyser(); analyser.fftSize = 512; source.connect(analyser);
          const samples = new Uint8Array(analyser.fftSize);
          waveIntervalRef.current = window.setInterval(() => {
            if (recorder.state !== 'recording') return;
            analyser.getByteTimeDomainData(samples);
            const rms = Math.sqrt(samples.reduce((sum, item) => sum + ((item - 128) / 128) ** 2, 0) / samples.length);
            setWaveform(current => [...current.slice(1), Math.min(1, rms * 5)]);
          }, 110);
        } catch { /* Recording remains available when waveform analysis is unsupported. */ }
      }
    } catch {
      stream?.getTracks().forEach(track => track.stop());
      setError(new Error(t('No se pudo acceder al micrófono.')));
    } finally { requestingMicRef.current = false; }
  }

  async function playVoice(message: Message) {
    if (!selected || !message.attachment || downloading) return;
    if (audioPlayback?.messageId === message.id) return;
    const conversation = selected.id;
    setDownloading(message.id); setError(undefined);
    try {
      const result = await api<ChatAttachment & {content:string}>(`conversations/${conversation}/messages/${message.id}/attachment`);
      if (!result.mime.startsWith('audio/')) throw new Error(t('El adjunto no es audio.'));
      const bytes = Uint8Array.from(atob(result.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
      if (selectedIdRef.current === conversation) setAudioPlayback({ messageId: message.id, url });
      else URL.revokeObjectURL(url);
    } catch (value) { setError(value); } finally { setDownloading(undefined); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selected || (!body.trim() && !file) || busy || recording || processingAudio) return;
    const conversation = selected.id;
    const draftGeneration = draftGenerationRef.current;
    const clientId = pendingId ?? crypto.randomUUID();
    setPendingId(clientId); setBusy(true); setSendError(undefined);
    try {
      let attachment: { name: string; content: string } | undefined;
      if (file) {
        const isImage = /\.(png|jpe?g|webp)$/i.test(file.name);
        if (file.size === 0 || file.size > (isImage ? 5 : 10) * 1024 * 1024 || !/\.(png|jpe?g|webp|pdf|docx|xlsx|wav|mp3)$/i.test(file.name))
          throw new Error(t('Adjunta una imagen de hasta 5 MB o un PDF, DOCX, XLSX, WAV o MP3 de hasta 10 MB.'));
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 32768)
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
        attachment = { name: file.name, content: btoa(binary) };
      }
      const value = await api<Message>(`conversations/${conversation}/messages`, 'POST', { client_id: clientId, body, reply_to_id: replyTo?.id ?? null, ...(attachment ? { attachment } : {}) });
      if (selectedIdRef.current === conversation) {
        setMessages(current => mergeMessages(current, [value]));
        if (draftGenerationRef.current === draftGeneration) {
          setBody(''); setFile(undefined); setPendingId(undefined); setReplyTo(undefined);
        }
        setSendError(undefined);
      }
      setRefresh(value => value + 1);
    } catch (value) { if (selectedIdRef.current === conversation) setSendError(value); }
    finally { setBusy(false); }
  }

  async function download(message: Message) {
    if (!selected || !message.attachment || downloading) return;
    setDownloading(message.id); setError(undefined);
    try {
      const result = await api<ChatAttachment & {content:string}>(`conversations/${selected.id}/messages/${message.id}/attachment`);
      const bytes = Uint8Array.from(atob(result.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
      const link = document.createElement('a'); link.href = url; link.download = result.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { setError(value); } finally { setDownloading(undefined); }
  }

  async function searchMessages(event: FormEvent) {
    event.preventDefault();
    if (!selected || searchTerm.trim().length < 2) return;
    const conversation = selected.id;
    setSearchBusy(true); setError(undefined);
    try {
      const result = await api<{items: Message[]}>(`conversations/${conversation}/search?q=${encodeURIComponent(searchTerm.trim())}`);
      if (selectedIdRef.current === conversation) setSearchResults(result.items);
    } catch (value) { setError(value); }
    finally { setSearchBusy(false); }
  }

  async function togglePin(message: Message) {
    if (!selected) return;
    const conversation = selected.id;
    try {
      const result = await api<{pinned: boolean}>(`conversations/${conversation}/messages/${message.id}/pin`, 'POST');
      if (selectedIdRef.current !== conversation) return;
      const updated = { ...message, pinned: result.pinned };
      setMessages(current => current.map(item => item.id === message.id ? updated : item));
      setPinnedMessages(current => result.pinned ? [updated, ...current.filter(item => item.id !== message.id)] : current.filter(item => item.id !== message.id));
      setSearchResults(current => current?.map(item => item.id === message.id ? updated : item));
    } catch (value) { setError(value); }
  }

  async function hideMessage() {
    if (!selected || !removeMessage) return;
    const conversation = selected.id;
    const id = removeMessage.id;
    try {
      await api(`conversations/${conversation}/messages/${id}`, 'DELETE');
      if (selectedIdRef.current !== conversation) return;
      setMessages(current => current.filter(item => item.id !== id));
      setPinnedMessages(current => current.filter(item => item.id !== id));
      setSearchResults(current => current?.filter(item => item.id !== id));
      if (replyTo?.id === id) setReplyTo(undefined);
      setRemoveMessage(undefined);
    } catch (value) { setError(value); }
  }

  async function clearConversation() {
    if (!selected) return;
    const conversation = selected.id;
    try {
      await api(`conversations/${conversation}/messages`, 'DELETE');
      if (selectedIdRef.current !== conversation) return;
      setMessages([]); setBefore(null); setPinnedMessages([]); setSearchResults(undefined);
      setReplyTo(undefined); setClearOpen(false);
      latestSequence.current = 0;
    } catch (value) { setError(value); }
  }

  return <>
    <div className="page-heading"><div><h1>{t('Chat de la junta')}</h1><p className="muted">{t('Conversaciones privadas entre cuentas de la junta activa.')}</p></div><button type="button" onClick={onContacts}>{t('Buscar contacto')}</button></div>
    <ErrorBox error={error} />
    <div className={`chat-layout${selected ? ' has-conversation' : ''}`}>
      <section className="panel chat-sidebar" aria-label={t('Conversaciones')}>
        <h2>{t('Conversaciones')}</h2>
        {loading ? <Loading /> : conversationError ? <button type="button" onClick={() => { setLoading(true); setRefresh(value => value + 1); }}>{t('Reintentar conversaciones')}</button> : conversations.length ? <ul className="chat-conversations">{conversations.map(item => <li key={item.id}><button type="button" aria-current={selected?.id === item.id ? 'true' : undefined} onClick={() => selectConversation(item)}><ContactAvatar organizationId={organizationId} userId={item.contact.id} name={item.contact.name} /><span className="chat-conversation-label"><strong>{item.contact.name}</strong><small className={item.contact_activity ? 'chat-activity' : 'presence-status'} data-state={contactPresences[item.contact.id] || 'offline'}>{item.contact_activity ? t(activityLabels[item.contact_activity]) : <><span aria-hidden="true">●</span> {t(presenceLabels[contactPresences[item.contact.id]] || 'Desconectado')}</>}</small></span></button></li>)}</ul> : <Empty title={t('Sin conversaciones')}>{t('Busca un contacto para iniciar una conversación.')}</Empty>}
        {conversationTotal > conversationPageSize && <div className="actions"><button type="button" disabled={loading || conversationPage <= 1} onClick={() => { setLoading(true); setConversationPage(page => page - 1); }}>{t('Conversaciones anteriores')}</button><span>{t('Página {page} de {pages}', {page: conversationPage, pages: Math.ceil(conversationTotal / conversationPageSize)})}</span><button type="button" disabled={loading || conversationPage * conversationPageSize >= conversationTotal} onClick={() => { setLoading(true); setConversationPage(page => page + 1); }}>{t('Conversaciones siguientes')}</button></div>}
      </section>
      <section className="panel chat-thread" aria-label={t('Mensajes')}>{selected ? <>
        <header className="chat-contact-heading">
          <button type="button" className="chat-contact-profile" onClick={() => setContactOpen(true)} aria-label={t('Ver perfil de {name}', {name: selected.contact.name})}><ContactAvatar organizationId={organizationId} userId={selected.contact.id} name={selected.contact.name} /><span className="chat-contact-name"><strong>{selected.contact.name}</strong>{selectedActivity ? <span className="chat-activity">{t(activityLabels[selectedActivity])}</span> : <span className="presence-status" data-state={contactDetails?.presence || 'offline'}><span aria-hidden="true">●</span> {t(presenceLabels[contactDetails?.presence || 'offline'])}</span>}</span></button>
          <div className="chat-header-actions">
            <button type="button" className="chat-icon-button" aria-label={t('Llamar a {name}', {name: selected.contact.name})} title={t('Llamar a {name}', {name: selected.contact.name})} onClick={() => window.dispatchEvent(new Event('srd-voice-call-start'))}><Phone size={19} /></button>
            <button type="button" className="chat-icon-button" aria-label={t('Buscar mensajes')} title={t('Buscar mensajes')} onClick={() => setSearchOpen(value => !value)}><Search size={19} /></button>
            <button type="button" className="chat-icon-button" aria-label={t('Vaciar chat para mí')} title={t('Vaciar chat para mí')} onClick={() => setClearOpen(true)}><Trash2 size={19} /></button>
          </div>
        </header>
        {messageLoading && <Loading />}
        {messageError && <div className="chat-thread-error"><ErrorBox error={messageError} /><button type="button" onClick={() => document.dispatchEvent(new Event('srd-chat-change'))}>{t('Reintentar mensajes')}</button></div>}
        {searchOpen && <form className="chat-search" onSubmit={searchMessages}><label className="chat-sr-only" htmlFor="chat-search-input">{t('Buscar mensajes')}</label><input id="chat-search-input" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setSearchResults(undefined); }} placeholder={t('Busca palabras o archivos')} minLength={2} maxLength={120} autoFocus /><button type="submit" disabled={searchBusy || searchTerm.trim().length < 2}><Search size={17} />{t('Buscar')}</button><button type="button" className="chat-icon-button" aria-label={t('Cerrar búsqueda')} onClick={() => { setSearchOpen(false); setSearchResults(undefined); }}><X size={18} /></button></form>}
        {searchResults && <div className="chat-search-results" role="status"><strong>{t('Resultados: {count}', {count: searchResults.length})}</strong>{searchResults.map(item => <div key={item.id}><span>{item.body || item.attachment?.name}</span><small>{new Date(item.created_at).toLocaleString(formatLocale(), {timeZone:'America/Bogota'})}</small></div>)}</div>}
        {pinnedMessages.length > 0 && <details className="chat-pinned"><summary><Pin size={15} /><strong>{t('Fijados')}</strong><span>{t('{count} mensajes', {count: pinnedMessages.length})}</span><ChevronDown size={17} /></summary><ul>{pinnedMessages.map(item => <li key={item.id}><span>{item.body || item.attachment?.name}</span><button type="button" className="chat-icon-button" title={t('Ir al mensaje')} aria-label={t('Ir al mensaje')} onClick={() => void jumpToMessage(item)}><Eye size={17} /></button></li>)}</ul></details>}
        {before && <button className="chat-older" type="button" onClick={() => void older()}>{t('Ver mensajes anteriores')}</button>}
        <ol className="chat-messages">{messages.map(message => <li key={message.id} id={`chat-message-${message.id}`} data-message-id={!message.system_kind && message.sender_id !== selfId && !message.read_at ? message.id : undefined} className={message.system_kind ? 'chat-call-event-row' : message.sender_id === selfId ? 'mine' : ''}>
          {message.system_kind ? <div className="chat-call-event"><Phone size={17} /><span><strong>{t(message.system_kind === 'call_missed' ? 'Llamada perdida' : 'Llamada finalizada')}</strong>{message.call_duration_seconds ? <small>{clockLabel(message.call_duration_seconds)}</small> : null}</span><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(formatLocale(), {timeZone:'America/Bogota'})}</time></div> : <>
          <div className="chat-bubble">
            <details className="chat-message-menu"><summary aria-label={t('Opciones del mensaje')} title={t('Opciones del mensaje')}><ChevronDown size={17} /></summary><div><button type="button" onClick={() => void togglePin(message)}><Pin size={15} fill={message.pinned ? 'currentColor' : 'none'} />{t(message.pinned ? 'Desfijar mensaje' : 'Fijar mensaje')}</button><button type="button" onClick={() => { draftGenerationRef.current++; setPendingId(undefined); setReplyTo(message); bodyInputRef.current?.focus(); }}><Reply size={15} />{t('Responder mensaje')}</button><button type="button" onClick={() => setRemoveMessage(message)}><Trash2 size={15} />{t(message.sender_id === selfId ? 'Borrar para todos' : 'Borrar para mí')}</button>{message.attachment && <button type="button" onClick={() => void download(message)}><Download size={15} />{t('Descargar')}</button>}</div></details>
            {message.reply_to_id && <div className="chat-reply-quote"><Reply size={14} /><span>{messages.find(item => item.id === message.reply_to_id)?.body || t('Mensaje anterior')}</span></div>}
            {message.body && <><p className={message.body.length > 480 && !expandedMessages.has(message.id) ? 'chat-text-collapsed' : ''}>{message.body}</p>{message.body.length > 480 && <button type="button" className="chat-expand-text" onClick={() => setExpandedMessages(current => { const next = new Set(current); if (next.has(message.id)) next.delete(message.id); else next.add(message.id); return next; })}>{expandedMessages.has(message.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{t(expandedMessages.has(message.id) ? 'Mostrar menos' : 'Mostrar más')}</button>}</>}
            {message.attachment?.mime.startsWith('image/') && <button type="button" className="chat-image-card" aria-label={t('Ampliar imagen {name}', {name: message.attachment.name})} onClick={() => { setImageViewer(message); setImageZoom(1); }}>{imagePreviews[message.id] ? <img src={imagePreviews[message.id]} alt={message.attachment.name} /> : <span><ImageIcon size={20} />{message.attachment.name}</span>}</button>}
            {message.attachment?.mime.startsWith('audio/') && <VoiceNotePlayer key={message.id} src={audioPlayback?.messageId === message.id ? audioPlayback.url : undefined} onRequest={() => void playVoice(message)} loading={downloading === message.id} label={t('Nota de voz de {name}', {name: message.sender_id === selfId ? t('Tú') : selected.contact.name})} />}
            {message.attachment && !message.attachment.mime.startsWith('image/') && !message.attachment.mime.startsWith('audio/') && <button type="button" className="chat-file-card" disabled={!!downloading} onClick={() => void download(message)}><FileText size={20} /><span>{message.attachment.name}<small>{(message.attachment.bytes / 1024 / 1024).toFixed(1)} MB</small></span><Download size={17} /></button>}
            <div className="chat-bubble-meta"><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(formatLocale(), {timeZone:'America/Bogota'})}</time><span>{t(message.sender_id === selfId ? message.read_at ? 'Leído' : message.delivered_at ? 'Entregado' : 'Enviado' : 'Recibido')}</span></div>
          </div>
          </>}
        </li>)}</ol>
        <form className="chat-composer" onSubmit={send}>
          {replyTo && <div className="chat-draft-reply"><Reply size={16} /><span>{t('Respondiendo a')} <strong>{replyTo.body || replyTo.attachment?.name}</strong></span><button type="button" aria-label={t('Cancelar respuesta')} onClick={() => { draftGenerationRef.current++; setPendingId(undefined); setReplyTo(undefined); }}><X size={17} /></button></div>}
          {file && <div className="chat-attachment-preview"><div className="chat-preview-info">{file.type.startsWith('image/') ? <ImageIcon size={19} /> : <FileText size={19} />}<span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span><button type="button" aria-label={t('Cancelar adjunto')} disabled={busy || recording} onClick={() => { setFile(undefined); setPendingId(undefined); setSendError(undefined); }}><X size={18} /></button></div>{filePreview && (/\.(png|jpe?g|webp)$/i.test(file.name) ? filePreviewError ? <p className="muted">{t('No se pudo mostrar la vista previa de la imagen.')}</p> : <img src={filePreview} alt={t('Vista previa del adjunto')} onError={() => setFilePreviewError(true)} /> : <VoiceNotePlayer src={filePreview} label={t('Vista previa de la nota de voz')} />)}</div>}
          {recording && <div className="chat-record-actions" role="status"><span className={recordPaused ? 'chat-record-dot paused' : 'chat-record-dot'} aria-hidden="true" /><time>{clockLabel(recordSeconds)}</time><span className="chat-record-wave" aria-hidden="true">{waveform.map((height, index) => <i key={index} style={{height: `${3 + height * 25}px`}} />)}</span><span className="chat-sr-only">{t(recordPaused ? 'Grabación pausada' : 'Grabando nota de voz')}</span><button type="button" className="chat-icon-button" title={t(recordPaused ? 'Reanudar grabación' : 'Pausar grabación')} aria-label={t(recordPaused ? 'Reanudar grabación' : 'Pausar grabación')} onClick={toggleRecordPause}>{recordPaused ? <Play size={19} /> : <Pause size={19} />}</button><button type="button" className="chat-icon-button" title={t('Terminar grabación')} aria-label={t('Terminar grabación')} onClick={() => stopRecording()}><Check size={19} /></button><button type="button" className="chat-icon-button" title={t('Descartar grabación')} aria-label={t('Descartar grabación')} onClick={() => stopRecording(true)}><Trash2 size={19} /></button></div>}
          {processingAudio && <p role="status">{t('Preparando nota de voz…')}</p>}
          <ErrorBox error={sendError} />
          <div className="chat-compose-row"><input ref={fileInputRef} className="chat-file-input" aria-hidden="true" tabIndex={-1} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.wav,.mp3" disabled={recording || processingAudio || busy} onChange={event => { draftGenerationRef.current++; setFilePreview(undefined); setFilePreviewError(false); setFile(event.target.files?.[0]); setPendingId(undefined); setSendError(undefined); event.target.value = ''; }} /><button type="button" className="chat-icon-button" title={t('Adjuntar archivo')} aria-label={t('Adjuntar archivo')} disabled={recording || processingAudio || busy} onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button><label className="chat-sr-only" htmlFor="chat-message-input">{t('Mensaje')}</label><textarea id="chat-message-input" ref={bodyInputRef} maxLength={10000} rows={1} placeholder={t('Mensaje')} value={body} onChange={event => { if (event.target.value !== body) { draftGenerationRef.current++; setPendingId(undefined); setSendError(undefined); } setBody(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 150)}px`; }} /><button type="button" className="chat-icon-button" aria-label={t('Grabar nota de voz')} title={t('Grabar nota de voz')} disabled={busy || processingAudio || recording} onClick={() => void startRecording()}><Mic size={20} /></button><button className="primary chat-send" aria-label={t(busy ? 'Enviando…' : 'Enviar')} disabled={busy || recording || processingAudio || (!body.trim() && !file)}><Send size={18} /><span>{t(busy ? 'Enviando…' : 'Enviar')}</span></button></div>
        </form>
      </> : <Empty title={t('Selecciona una conversación')}>{t('Elige una conversación o busca un contacto.')}</Empty>}</section>
    </div>
    {imageViewer && <Modal title={t('Vista ampliada de imagen')} onClose={() => setImageViewer(undefined)}><div className="chat-image-viewer"><div className="chat-image-toolbar"><button type="button" title={t(imageViewer.pinned ? 'Desfijar mensaje' : 'Fijar mensaje')} aria-label={t(imageViewer.pinned ? 'Desfijar mensaje' : 'Fijar mensaje')} onClick={() => void togglePin(imageViewer)}><Pin size={18} /></button><button type="button" title={t('Responder mensaje')} aria-label={t('Responder mensaje')} onClick={() => { setReplyTo(imageViewer); setImageViewer(undefined); bodyInputRef.current?.focus(); }}><Reply size={18} /></button><button type="button" title={t('Borrar mensaje')} aria-label={t('Borrar mensaje')} onClick={() => { setRemoveMessage(imageViewer); setImageViewer(undefined); }}><Trash2 size={18} /></button><button type="button" title={t('Descargar')} aria-label={t('Descargar')} onClick={() => void download(imageViewer)}><Download size={18} /></button><span aria-hidden="true" /><button type="button" title={t('Reducir')} aria-label={t('Reducir')} onClick={() => setImageZoom(value => Math.max(1, value - .5))}><ZoomOut size={18} /></button><strong>{Math.round(imageZoom * 100)}%</strong><button type="button" title={t('Ampliar')} aria-label={t('Ampliar')} onClick={() => setImageZoom(value => Math.min(4, value + .5))}><ZoomIn size={18} /></button></div>{imagePreviews[imageViewer.id] ? <div className="chat-image-viewport"><button type="button" className={`chat-image-zoom-target${imageZoom > 1 ? ' zoomed' : ''}`} aria-label={t(imageZoom > 1 ? 'Reducir imagen' : 'Ampliar imagen')} onClick={() => setImageZoom(value => value > 1 ? 1 : 2)}><img src={imagePreviews[imageViewer.id]} alt={imageViewer.attachment?.name || t('Imagen')} style={{ transform: `scale(${imageZoom})` }} /></button></div> : <p>{t('Cargando imagen…')}</p>}</div></Modal>}
    {contactOpen && selected && <Modal title={t('Perfil del contacto')} onClose={() => setContactOpen(false)}><div className="chat-contact-card"><ContactAvatar organizationId={organizationId} userId={selected.contact.id} name={selected.contact.name} /><div><h3>{contactDetails?.name || selected.contact.name}</h3><span className="presence-status" data-state={contactDetails?.presence || 'offline'}><span aria-hidden="true">●</span> {t(presenceLabels[contactDetails?.presence || 'offline'])}</span>{contactDetails?.title && <p>{localizedLabel({label: contactDetails.title, label_en: contactDetails.title_en})}</p>}</div></div></Modal>}
    {removeMessage && <Modal title={t(removeMessage.sender_id === selfId ? 'Borrar para todos' : 'Borrar para mí')} onClose={() => setRemoveMessage(undefined)}><p>{t(removeMessage.sender_id === selfId ? 'Este mensaje dejará de aparecer para ambos participantes.' : 'Este mensaje dejará de aparecer solo en tu cuenta.')}</p><div className="actions end"><button type="button" onClick={() => setRemoveMessage(undefined)}>{t('Cancelar')}</button><button type="button" className="danger-button" onClick={() => void hideMessage()}>{t(removeMessage.sender_id === selfId ? 'Borrar para todos' : 'Borrar para mí')}</button></div></Modal>}
    {clearOpen && <Modal title={t('Vaciar chat para mí')} onClose={() => setClearOpen(false)}><p>{t('Los mensajes actuales dejarán de aparecer solo en tu cuenta. Los mensajes nuevos seguirán llegando.')}</p><div className="actions end"><button type="button" onClick={() => setClearOpen(false)}>{t('Cancelar')}</button><button type="button" className="danger-button" onClick={() => void clearConversation()}>{t('Vaciar chat')}</button></div></Modal>}
  </>;
}
