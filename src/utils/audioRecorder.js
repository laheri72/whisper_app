/**
 * Real-Time 16kHz PCM WAV Audio Recorder Utility for Academic Quran Portal
 * Captures microphone audio using Web Audio API AudioContext at 16,000 Hz sample rate
 * and encodes pure uncompressed 16-bit PCM WAV blobs for ffmpeg-free ASR model pipeline.
 */

export class BatchAudioRecorder {
  constructor() {
    this.audioContext = null;
    this.stream = null;
    this.analyser = null;
    this.scriptNode = null;
    this.pcmBuffers = [];
    this.isRecording = false;
    this.startTime = null;
  }

  async startRecording(onDataAvailable = null) {
    this.pcmBuffers = [];
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        } 
      });

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      const source = this.audioContext.createMediaStreamSource(this.stream);

      // Setup Analyser for live visualizer
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      // ScriptProcessorNode to capture raw float32 PCM samples at 16kHz
      this.scriptNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.scriptNode.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Make a copy of the Float32Array chunk
        this.pcmBuffers.push(new Float32Array(inputData));
        if (onDataAvailable) onDataAvailable(inputData);
      };

      source.connect(this.scriptNode);
      this.scriptNode.connect(this.audioContext.destination);

      this.isRecording = true;
      this.startTime = Date.now();
      return true;
    } catch (err) {
      console.error("Failed to access microphone:", err);
      throw new Error("Microphone access permission denied or microphone unavailable.");
    }
  }

  stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.isRecording) {
        return reject(new Error("No active recording found."));
      }

      this.isRecording = false;

      // Calculate total samples collected
      let totalSamples = 0;
      for (const buf of this.pcmBuffers) {
        totalSamples += buf.length;
      }

      if (totalSamples === 0) {
        this.cleanup();
        return resolve(new Blob([], { type: 'audio/wav' }));
      }

      // Merge Float32Array chunks
      const mergedSamples = new Float32Array(totalSamples);
      let offset = 0;
      for (const buf of this.pcmBuffers) {
        mergedSamples.set(buf, offset);
        offset += buf.length;
      }

      // Encode merged float32 samples into standard 16-bit PCM WAV Blob with native sample rate
      const nativeSampleRate = this.audioContext ? this.audioContext.sampleRate : 44100;
      const wavBlob = encodeWAV(mergedSamples, nativeSampleRate);
      this.cleanup();
      resolve(wavBlob);
    });
  }

  getAnalyser() {
    return this.analyser;
  }

  getElapsedTime() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  cleanup() {
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.isRecording = false;
  }
}

// Helper to write standard RIFF WAV header for 16-bit 16kHz mono PCM audio
function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF format */
  writeString(view, 8, 'WAVE');
  /* Subchunk1 ID ('fmt ') */
  writeString(view, 12, 'fmt ');
  /* Subchunk1 size (16 for PCM) */
  view.setUint32(16, 16, true);
  /* Audio format (1 = PCM) */
  view.setUint16(20, 1, true);
  /* Num channels (1 = Mono) */
  view.setUint16(22, 1, true);
  /* Sample rate (16000 Hz) */
  view.setUint32(24, sampleRate, true);
  /* Byte rate (sampleRate * 2) */
  view.setUint32(28, sampleRate * 2, true);
  /* Block align (2 bytes) */
  view.setUint16(32, 2, true);
  /* Bits per sample (16 bits) */
  view.setUint16(34, 16, true);
  /* Subchunk2 ID ('data') */
  writeString(view, 36, 'data');
  /* Subchunk2 size */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples (convert float32 -1.0..1.0 to int16 -32768..32767)
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
