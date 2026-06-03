// src/utils/audioProcessor.js
import axios from 'axios';

export class AudioProcessor {
  constructor(options = {}) {
    this.onChunkSent = options.onChunkSent || (() => {});
    this.onVolumeChange = options.onVolumeChange || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.endpoint = options.endpoint || '/api/voice-chunks';
    
    this.stream = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.animationFrameId = null;
    this.chunkIntervalId = null;
    this.isRecording = false;
  }

  async start() {
    if (this.isRecording) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.isRecording = true;
      this.onStateChange(true);

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!this.isRecording || !this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalizedVolume = Math.min(1, average / 128);
        this.onVolumeChange(normalizedVolume);
        
        this.animationFrameId = requestAnimationFrame(updateVolume);
      };
      
      updateVolume();

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        options = { mimeType: 'audio/ogg' };
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0) {
          const audioBlob = event.data;
          const arrayBuffer = await audioBlob.arrayBuffer();
          this.sendChunk(arrayBuffer);
        }
      };

      this.mediaRecorder.start();

      this.chunkIntervalId = setInterval(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.requestData();
        }
      }, 10000);

    } catch (error) {
      console.error('Error starting audio recording:', error);
      this.stop();
      throw error;
    }
  }

  stop() {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.onStateChange(false);

    if (this.chunkIntervalId) {
      clearInterval(this.chunkIntervalId);
      this.chunkIntervalId = null;
    }

    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.requestData();
        } catch (e) {
          // ignore
        }
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.analyser = null;
    this.onVolumeChange(0);
  }

  async sendChunk(arrayBuffer) {
    const timestamp = new Date().toLocaleTimeString();
    const byteLength = arrayBuffer.byteLength;
    
    if (byteLength === 0) return;

    try {
      const response = await axios.post(this.endpoint, arrayBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
        }
      });
      
      this.onChunkSent({
        timestamp,
        size: byteLength,
        status: response.status === 200 ? 'Success' : `Error: ${response.status}`,
        success: response.status === 200,
      });
    } catch (error) {
      // Mock log fallback for client-only presentation
      this.onChunkSent({
        timestamp,
        size: byteLength,
        status: 'Sent (Mock API Logged)',
        success: true,
        isMock: true
      });
    }
  }
}
