const SAMPLE_RATE = 16000;
const MAX_SECONDS = 120;

export async function recordedBlobToWav(blob: Blob): Promise<File> {
  if (blob.size === 0 || blob.size > 10 * 1024 * 1024) throw new Error('invalid recording size');
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration <= 0 || decoded.duration > MAX_SECONDS + 1 || decoded.numberOfChannels < 1)
      throw new Error('invalid recording duration');
    const offline = new OfflineAudioContext(1, Math.min(Math.ceil(decoded.duration * SAMPLE_RATE), MAX_SECONDS * SAMPLE_RATE), SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);
    const wav = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(wav);
    const label = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    label(0, 'RIFF'); view.setUint32(4, wav.byteLength - 8, true); label(8, 'WAVE');
    label(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); label(36, 'data'); view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
    return new File([wav], `nota-de-voz-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`, { type: 'audio/wav' });
  } finally {
    await context.close();
  }
}
