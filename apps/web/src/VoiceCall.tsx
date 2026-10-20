import { useEffect, useRef, useState } from 'react';
import { ApiError, api } from './api';
import { t, useLanguage } from './i18n';
import { ErrorBox } from './ui';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { ContactAvatar } from './ContactAvatar';

type Call = { id: string; conversation_id: string; caller_id: string; callee_id: string; status: string; answered_at?: string | null };
type Signal = { sequence: number; kind: 'offer' | 'answer' | 'candidate' | 'mute'; payload: RTCSessionDescriptionInit & RTCIceCandidateInit & {muted?: boolean} };

export function VoiceCall({ conversationId, contactName, selfId, selfName, selfPhoto, organizationId, doNotDisturb }: { conversationId?: string; contactName?: string; selfId: string; selfName: string; selfPhoto?: string | null; organizationId: string; doNotDisturb: boolean }) {
  useLanguage();
  const [call, setCall] = useState<Call>();
  const [incoming, setIncoming] = useState<Call>();
  const [incomingName, setIncomingName] = useState('');
  const [activeContact, setActiveContact] = useState<{id: string; name: string}>();
  const [muted, setMuted] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [durationTick, setDurationTick] = useState(Date.now());
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<unknown>();
  const callRef = useRef<Call | undefined>(undefined);
  const incomingRef = useRef<string | undefined>(undefined);
  const peerRef = useRef<RTCPeerConnection | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement>(null);
  const afterRef = useRef(0);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const busyPoll = useRef(false);
  const lastHealthyPoll = useRef(Date.now());
  const mounted = useRef(true);

  function setCurrent(value?: Call) {
    callRef.current = value;
    setCall(value);
    lastHealthyPoll.current = Date.now();
    afterRef.current = 0;
    pendingCandidates.current = [];
  }

  function release() {
    peerRef.current?.close();
    peerRef.current = undefined;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = undefined;
    if (audioRef.current) audioRef.current.srcObject = null;
    setMuted(false);
    setRemoteMuted(false);
  }

  async function transition(value: Call, action: 'accept' | 'reject' | 'end' | 'fail') {
    return api<Call>(`conversations/${value.conversation_id}/calls/${value.id}/transition`, 'POST', { action });
  }

  function makePeer(value: Call, stream: MediaStream, iceServers: RTCIceServer[]) {
    const peer = new RTCPeerConnection({ iceServers });
    peerRef.current = peer;
    stream.getAudioTracks().forEach(track => peer.addTrack(track, stream));
    peer.ontrack = event => { if (audioRef.current) audioRef.current.srcObject = event.streams[0]; };
    peer.onicecandidate = event => {
      if (!event.candidate || callRef.current?.id !== value.id) return;
      void api(`conversations/${value.conversation_id}/calls/${value.id}/signal`, 'POST', {
        kind: 'candidate', payload: event.candidate.toJSON(),
      }).catch(setError);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' && callRef.current?.id === value.id) {
        void transition(value, 'fail').catch(setError).finally(() => { release(); setCurrent(); });
      }
    };
    return peer;
  }

  async function start() {
    if (!conversationId || callRef.current || working) return;
    setWorking(true); setError(undefined);
    let created: Call | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error(t('Este navegador no permite llamadas de voz.'));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const { iceServers } = await api<{ iceServers: RTCIceServer[] }>('voice-calls/ice-config');
      created = await api<Call>(`conversations/${conversationId}/calls`, 'POST');
      setCurrent(created);
      void api<{contact: {id: string; name: string}}>(`conversations/${conversationId}`)
        .then(value => setActiveContact(value.contact)).catch(() => undefined);
      const peer = makePeer(created, stream, iceServers);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await api(`conversations/${conversationId}/calls/${created.id}/signal`, 'POST', { kind: 'offer', payload: { type: 'offer', sdp: offer.sdp } });
    } catch (value) {
      if (created) void transition(created, 'fail').catch(() => undefined);
      release(); setCurrent(); setError(value);
    } finally { setWorking(false); }
  }

  async function accept() {
    const value = incoming;
    if (!value || working || callRef.current) return;
    setWorking(true); setError(undefined);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error(t('Este navegador no permite llamadas de voz.'));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const { iceServers } = await api<{ iceServers: RTCIceServer[] }>('voice-calls/ice-config');
      const accepted = await transition(value, 'accept');
      setIncoming(undefined);
      setCurrent(accepted);
      void api<{contact: {id: string; name: string}}>(`conversations/${value.conversation_id}`)
        .then(value => setActiveContact(value.contact)).catch(() => undefined);
      makePeer(accepted, stream, iceServers);
    } catch (reason) {
      release(); setError(reason);
    } finally { setWorking(false); }
  }

  async function reject() {
    const value = incoming;
    if (!value || working) return;
    setWorking(true); setError(undefined);
    try { await transition(value, 'reject'); setIncoming(undefined); }
    catch (reason) { setError(reason); }
    finally { setWorking(false); }
  }

  async function end() {
    const value = callRef.current;
    if (!value) return;
    release(); setCurrent();
    try { await transition(value, 'end'); }
    catch (reason) { setError(reason); }
  }

  async function toggleMute() {
    const value = callRef.current;
    const track = streamRef.current?.getAudioTracks()[0];
    if (!value || !track) return;
    const next = track.enabled;
    track.enabled = !next;
    setMuted(next);
    try {
      await api(`conversations/${value.conversation_id}/calls/${value.id}/signal`, 'POST', { kind: 'mute', payload: {muted: next} });
    } catch (reason) { track.enabled = next; setMuted(!next); setError(reason); }
  }

  async function readSignals(value: Call) {
    const signals = await api<Signal[]>(`conversations/${value.conversation_id}/calls/${value.id}/signals?after=${afterRef.current}`);
    for (const signal of signals) {
      if (callRef.current?.id !== value.id) return;
      const peer = peerRef.current;
      if (!peer) return;
      if (signal.kind === 'offer' && value.callee_id === selfId && !peer.remoteDescription) {
        await peer.setRemoteDescription({ type: 'offer', sdp: signal.payload.sdp });
        for (const candidate of pendingCandidates.current) await peer.addIceCandidate(candidate);
        pendingCandidates.current = [];
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await api(`conversations/${value.conversation_id}/calls/${value.id}/signal`, 'POST', { kind: 'answer', payload: { type: 'answer', sdp: answer.sdp } });
      } else if (signal.kind === 'answer' && value.caller_id === selfId && !peer.remoteDescription) {
        await peer.setRemoteDescription({ type: 'answer', sdp: signal.payload.sdp });
        for (const candidate of pendingCandidates.current) await peer.addIceCandidate(candidate);
        pendingCandidates.current = [];
      } else if (signal.kind === 'candidate') {
        const candidate = { candidate: signal.payload.candidate, sdpMid: signal.payload.sdpMid, sdpMLineIndex: signal.payload.sdpMLineIndex };
        if (peer.remoteDescription) await peer.addIceCandidate(candidate);
        else pendingCandidates.current.push(candidate);
      } else if (signal.kind === 'mute') {
        setRemoteMuted(Boolean(signal.payload.muted));
      }
      afterRef.current = signal.sequence;
    }
  }

  useEffect(() => {
    mounted.current = true;
    const poll = async () => {
      if (busyPoll.current || !mounted.current) return;
      busyPoll.current = true;
      try {
        const active = callRef.current;
        if (active) {
          const latest = await api<Call>(`conversations/${active.conversation_id}/calls/${active.id}`);
          if (callRef.current?.id !== active.id) return;
          if (!['ringing', 'accepted'].includes(latest.status)) { release(); setCurrent(); return; }
          setCall(latest);
          await readSignals(latest);
          lastHealthyPoll.current = Date.now();
        } else {
          const list = await api<Call[]>('voice-calls');
          if (callRef.current || !mounted.current) return;
          const next = list[0];
          setIncoming(next);
          if (next && next.id !== incomingRef.current) {
            incomingRef.current = next.id;
            void api<{ contact: { name: string } }>(`conversations/${next.conversation_id}`)
              .then(conversation => { if (mounted.current) { setIncomingName(conversation.contact.name); setActiveContact(conversation.contact as {id: string; name: string}); } })
              .catch(() => setIncomingName(''));
          }
          if (!next) incomingRef.current = undefined;
        }
      } catch (reason) {
        const active = callRef.current;
        if (mounted.current && active) {
          if ((reason instanceof ApiError && [401, 403].includes(reason.status))
            || Date.now() - lastHealthyPoll.current > 20000) {
            release(); setCurrent();
            setError(new Error(t('La llamada se interrumpió. Revisa la conexión e inténtalo de nuevo.')));
            if (!(reason instanceof ApiError && [401, 403].includes(reason.status))) {
              void transition(active, 'fail').catch(() => undefined);
            }
          } else setError(reason);
        }
      }
      finally { busyPoll.current = false; }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 1500);
    const onChange = () => void poll();
    document.addEventListener('srd-chat-change', onChange);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      document.removeEventListener('srd-chat-change', onChange);
      const active = callRef.current;
      if (active) void transition(active, 'end').catch(() => undefined);
      release();
    };
  }, [selfId]);

  useEffect(() => {
    const onStart = () => void start();
    window.addEventListener('srd-voice-call-start', onStart);
    return () => window.removeEventListener('srd-voice-call-start', onStart);
  });

  useEffect(() => {
    if (call?.status !== 'accepted') return;
    const interval = window.setInterval(() => setDurationTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [call?.status]);

  if (!call && (!incoming || doNotDisturb) && !conversationId && !error) return null;
  const active = !!call || (!!incoming && !doNotDisturb);
  return <div className={active ? 'voice-call voice-call-active' : 'voice-call'} aria-live="polite">
    <audio ref={audioRef} autoPlay playsInline aria-label={t('Audio de la llamada')} />
    {!!error && <ErrorBox error={error} />}
    {active && <div className="voice-call-backdrop"><div className="voice-call-dialog" role="dialog" aria-modal="true" aria-label={t('Llamada de voz')}>
      <div className="voice-call-participants"><div><span className="avatar voice-call-avatar">{selfPhoto ? <img src={selfPhoto} alt="" /> : selfName.slice(0, 1)}</span><strong>{selfName}</strong><small>{t(muted ? 'Micrófono apagado' : 'Micrófono encendido')}</small>{muted ? <MicOff size={16} /> : <Mic size={16} />}</div><div>{activeContact?.id ? <ContactAvatar organizationId={organizationId} userId={activeContact.id} name={activeContact.name} /> : <span className="avatar voice-call-avatar"><Phone size={25} /></span>}<strong>{activeContact?.name || contactName || incomingName || t('un integrante')}</strong><small>{t(remoteMuted ? 'Micrófono apagado' : 'Micrófono encendido')}</small>{remoteMuted ? <MicOff size={16} /> : <Mic size={16} />}</div></div>
      <h2>{call ? t(call.status === 'ringing' ? 'Llamando…' : 'Llamada en curso') : t('Llamada entrante de {name}', {name: incomingName || t('un integrante')})}</h2>
      {call?.status === 'accepted' && <p className="voice-call-duration">{Math.floor(Math.max(0, durationTick - new Date(call.answered_at || Date.now()).getTime()) / 60000)}:{String(Math.floor(Math.max(0, durationTick - new Date(call.answered_at || Date.now()).getTime()) / 1000) % 60).padStart(2, '0')}</p>}
      <div className="voice-call-actions">
        {incoming && !call && <button type="button" className="voice-call-accept" disabled={working} onClick={() => void accept()}><Phone size={20} />{t('Aceptar llamada')}</button>}
        {call && <button type="button" disabled={working} onClick={() => void toggleMute()}>{muted ? <MicOff size={20} /> : <Mic size={20} />}{t(muted ? 'Activar micrófono' : 'Silenciar micrófono')}</button>}
        <button type="button" className="voice-call-end" disabled={working} onClick={() => void (call ? end() : reject())}><PhoneOff size={20} />{t(call ? 'Finalizar llamada' : 'Rechazar llamada')}</button>
      </div>
    </div></div>}
  </div>;
}
