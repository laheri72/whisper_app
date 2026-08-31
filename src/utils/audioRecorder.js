/**
 * Real-Time 16kHz PCM WAV Audio Recorder Utility for Academic Quran Portal
 * Captures microphone audio using Web Audio API AudioContext at 16,000 Hz sample rate
 * and encodes pure uncompressed 16-bit PCM WAV blobs for ffmpeg-free ASR model pipeline.
 */

export class WaveMediaRecorder {
  constructor(stream) {
    this.stream = stream;
    this.audioContext = null;
    this.analyser = null;
    this.scriptNode = null;
    this.chunkPcmBuffer = [];
    this.fullPcmBuffer = [];
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.intervalId = null;
    this.sampleRate = 16000; // Force 16kHz sample rate for Whisper AI
  }

  start(timeslice = 10000) {
    if (this.state !== 'inactive') return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioCtx({ sampleRate: this.sampleRate });
    const source = this.audioContext.createMediaStreamSource(this.stream);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 64;
    source.connect(this.analyser);

    this.scriptNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.scriptNode.onaudioprocess = (e) => {
      if (this.state !== 'recording') return;
      const inputData = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(inputData);
      
      this.chunkPcmBuffer.push(copy);
      this.fullPcmBuffer.push(copy);
    };

    source.connect(this.scriptNode);
    this.scriptNode.connect(this.audioContext.destination);

    this.state = 'recording';

    if (timeslice > 0) {
      this.intervalId = setInterval(() => {
        this.flushChunk();
      }, timeslice);
    }
  }

  pause() {
    if (this.state !== 'recording') return;
    this.state = 'paused';
    if (this.audioContext) {
      this.audioContext.suspend();
    }
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'recording';
    if (this.audioContext) {
      this.audioContext.resume();
    }
  }

  flushChunk() {
    if (this.chunkPcmBuffer.length === 0) return;

    let totalSamples = 0;
    for (const buf of this.chunkPcmBuffer) {
      totalSamples += buf.length;
    }

    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const buf of this.chunkPcmBuffer) {
      merged.set(buf, offset);
      offset += buf.length;
    }

    this.chunkPcmBuffer = [];
    const wavBlob = encodeWAV(merged, this.sampleRate);
    if (this.ondataavailable) {
      this.ondataavailable({ data: wavBlob });
    }
  }

  stop() {
    if (this.state === 'inactive') return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.state = 'inactive';
    this.flushChunk();

    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    let totalSamples = 0;
    for (const buf of this.fullPcmBuffer) {
      totalSamples += buf.length;
    }

    let fullBlob = new Blob([], { type: 'audio/wav' });
    if (totalSamples > 0) {
      const merged = new Float32Array(totalSamples);
      let offset = 0;
      for (const buf of this.fullPcmBuffer) {
        merged.set(buf, offset);
        offset += buf.length;
      }
      fullBlob = encodeWAV(merged, this.sampleRate);
    }

    this.fullPcmBuffer = [];
    this.chunkPcmBuffer = [];

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().then(() => {
        this.audioContext = null;
        if (this.onstop) {
          this.onstop(fullBlob);
        }
      });
    } else {
      if (this.onstop) {
        this.onstop(fullBlob);
      }
    }
  }

  getCurrentAudioBlob() {
    let totalSamples = 0;
    for (const buf of this.fullPcmBuffer) {
      totalSamples += buf.length;
    }
    if (totalSamples === 0) return null;

    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const buf of this.fullPcmBuffer) {
      merged.set(buf, offset);
      offset += buf.length;
    }
    return encodeWAV(merged, this.sampleRate);
  }

  abort() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.state = 'inactive';
    this.onstop = null;
    this.ondataavailable = null;

    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.fullPcmBuffer = [];
    this.chunkPcmBuffer = [];

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  getAnalyser() {
    return this.analyser;
  }
}

function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let index = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    index += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
