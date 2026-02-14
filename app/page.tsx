'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const TARGET_SAMPLE_RATE = 16000;

export default function Home() {
  const [callActive, setCallActive] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const [isMicOn, setIsMicOn] = useState(false);
  const [geminiText, setGeminiText] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGeminiSpeaking, setIsGeminiSpeaking] = useState(false);
  const [conversationLog, setConversationLog] = useState<
    { role: 'user' | 'gemini'; text: string }[]
  >([]);

  const streamRef = useRef<MediaStream | null>(null);
  const callActiveRef = useRef(false);
  const emergencyRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmBufferRef = useRef<Int16Array[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs with state
  useEffect(() => { callActiveRef.current = callActive; }, [callActive]);
  useEffect(() => { emergencyRef.current = emergency; }, [emergency]);

  // Call timer
  useEffect(() => {
    if (!callActive) return;
    const timer = setInterval(() => setCallTime((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [callActive]);

  // ── PCM Audio Capture ──
  // Downsample Float32 audio from browser sample rate to target 16kHz
  function downsampleTo16kHz(buffer: Float32Array, inputRate: number): Int16Array {
    const ratio = inputRate / TARGET_SAMPLE_RATE;
    const outputLength = Math.floor(buffer.length / ratio);
    const result = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = Math.floor(i * ratio);
      // Clamp and convert float32 [-1, 1] to int16 [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, buffer[srcIndex]));
      result[i] = sample < 0 ? sample * 32768 : sample * 32767;
    }
    return result;
  }

  // Convert Int16Array to base64
  function int16ToBase64(samples: Int16Array): string {
    const bytes = new Uint8Array(samples.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // ── Audio Playback ──
  const playAudioResponse = useCallback(async (audioBase64: string, mimeType: string) => {
    if (!audioBase64) return;

    try {
      setIsGeminiSpeaking(true);
      const params = parsePcmMimeType(mimeType);

      if (params) {
        const rawBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const ctx = playbackContextRef.current || new AudioContext();
        playbackContextRef.current = ctx;

        const samples = new Float32Array(rawBytes.length / (params.bitsPerSample / 8));
        const view = new DataView(rawBytes.buffer);

        for (let i = 0; i < samples.length; i++) {
          if (params.bitsPerSample === 16) {
            samples[i] = view.getInt16(i * 2, true) / 32768;
          }
        }

        const audioBuffer = ctx.createBuffer(1, samples.length, params.sampleRate);
        audioBuffer.getChannelData(0).set(samples);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsGeminiSpeaking(false);
        source.start();
      } else {
        // Encoded audio fallback
        const rawBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const ctx = playbackContextRef.current || new AudioContext();
        playbackContextRef.current = ctx;

        const audioBuffer = await ctx.decodeAudioData(rawBytes.buffer.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsGeminiSpeaking(false);
        source.start();
      }
    } catch (err) {
      console.error('[Audio] Playback error:', err);
      setIsGeminiSpeaking(false);
    }
  }, []);

  function parsePcmMimeType(mime: string): { sampleRate: number; bitsPerSample: number } | null {
    if (!mime) return null;
    const lower = mime.toLowerCase();
    if (!lower.includes('audio/l') && !lower.includes('audio/pcm')) return null;

    let bitsPerSample = 16;
    const bitsMatch = lower.match(/audio\/l(\d+)/);
    if (bitsMatch) bitsPerSample = parseInt(bitsMatch[1], 10);

    let sampleRate = 24000;
    const rateMatch = lower.match(/rate=(\d+)/);
    if (rateMatch) sampleRate = parseInt(rateMatch[1], 10);

    return { sampleRate, bitsPerSample };
  }

  // ── Send accumulated PCM to server ──
  const sendPcmToServer = useCallback(async () => {
    const chunks = pcmBufferRef.current;
    pcmBufferRef.current = [];

    if (chunks.length === 0 || !callActiveRef.current || emergencyRef.current) return;

    // Merge all chunks into one Int16Array
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const base64 = int16ToBase64(merged);
    console.log('[Mic] Sending', merged.length, 'samples as PCM');

    setLoading(true);
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process', audio: base64 }),
      });

      if (!res.ok) {
        console.error('[Call] API error:', res.status);
        return;
      }

      const data = await res.json();

      if (data.geminiText) {
        setGeminiText(data.geminiText);
        setConversationLog((prev) => [
          ...prev.slice(-10),
          { role: 'gemini', text: data.geminiText },
        ]);
      }

      if (data.emergency) {
        setEmergency(true);
        return;
      }

      // Play Gemini's audio response
      if (data.geminiAudio) {
        await playAudioResponse(data.geminiAudio, data.audioMimeType || '');
      }
    } catch (err) {
      console.error('[Call] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [playAudioResponse]);

  // ── Recording with ScriptProcessorNode (raw PCM) ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      // Create AudioContext at browser's native sample rate
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const inputSampleRate = audioContext.sampleRate;

      const source = audioContext.createMediaStreamSource(stream);

      // ScriptProcessorNode captures raw PCM samples
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!callActiveRef.current || emergencyRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Downsample to 16kHz and convert to Int16
        const pcm16k = downsampleTo16kHz(inputData, inputSampleRate);
        pcmBufferRef.current.push(pcm16k);
      };

      source.connect(processor);
      processor.connect(audioContext.destination); // Required for processing to work

      setIsMicOn(true);

      // Send accumulated PCM every 3 seconds
      const sendLoop = () => {
        if (!callActiveRef.current || emergencyRef.current) return;

        sendPcmToServer().then(() => {
          if (callActiveRef.current && !emergencyRef.current) {
            recordingTimerRef.current = setTimeout(sendLoop, 3000);
          }
        });
      };

      // First send after 3 seconds
      recordingTimerRef.current = setTimeout(sendLoop, 3000);
    } catch (err) {
      console.error('[Mic] Error:', err);
      setStatus('❌ Microphone access denied');
    }
  }, [sendPcmToServer]);

  // ── Call Controls ──
  const startCall = async () => {
    setIsConnecting(true);
    setCallTime(0);
    setEmergency(false);
    setGeminiText('');
    setConversationLog([]);
    setStatus('Connecting to Gemini...');

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init' }),
      });

      if (!res.ok) throw new Error('Failed to connect');
      const data = await res.json();

      if (!data.active) {
        throw new Error('Session not active after init');
      }

      setCallActive(true);
      setIsConnecting(false);
      setStatus('');

      startRecording();
    } catch (err) {
      console.error('[Call] Init error:', err);
      setStatus('❌ Failed to connect: ' + String(err));
      setIsConnecting(false);
    }
  };

  const endCall = async () => {
    setCallActive(false);
    setIsMicOn(false);
    setLoading(false);

    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      try { await audioContextRef.current.close(); } catch { /* ignore */ }
      audioContextRef.current = null;
    }

    if (playbackContextRef.current) {
      try { await playbackContextRef.current.close(); } catch { /* ignore */ }
      playbackContextRef.current = null;
    }

    pcmBufferRef.current = [];

    try {
      await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
    } catch { /* ignore */ }
  };

  const cancelEmergency = () => {
    setEmergency(false);
    setGeminiText('');
    endCall();
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Emergency Screen ──
  if (emergency) {
    return (
      <div className="emergency-screen">
        <div className="emergency-content">
          <div className="emergency-icon">🚨</div>
          <h1 className="emergency-title">EMERGENCY DETECTED</h1>
          <p className="emergency-subtitle">Danger signals detected in audio</p>
          {geminiText && (
            <div className="emergency-detail">
              <strong>AI Analysis:</strong> {geminiText}
            </div>
          )}
          <div className="emergency-actions">
            <a href="tel:112" className="emergency-call-btn">📞 Call 112 Now</a>
            <button onClick={cancelEmergency} className="emergency-cancel-btn">Cancel Alert</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main UI ──
  return (
    <div className="app-container">
      <div className="phone-card">
        <div className="card-header">
          <div className="shield-icon">🛡️</div>
          <h1 className="app-title">Silent Guardian</h1>
          <p className="app-subtitle">
            {callActive ? 'Call in Progress' : isConnecting ? 'Connecting...' : 'AI-Powered Safety Companion'}
          </p>
        </div>

        <div className="call-display">
          <div className={`timer ${callActive ? 'timer-active' : ''}`}>
            {formatTime(callTime)}
          </div>

          {callActive && (
            <div className="waveform-container">
              <div className="waveform-bars">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className={`waveform-bar ${isMicOn ? 'waveform-bar-active' : ''} ${isGeminiSpeaking ? 'waveform-bar-speaking' : ''}`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
              <p className="waveform-label">
                {loading ? '✨ Gemini is thinking...' : isGeminiSpeaking ? '🔊 Gemini is speaking' : isMicOn ? '🎙️ Listening...' : '⏳ Processing...'}
              </p>
            </div>
          )}
        </div>

        {geminiText && callActive && (
          <div className="response-box">
            <span className="response-label">Gemini</span>
            <p className="response-text">{geminiText}</p>
          </div>
        )}

        {status && <div className="status-box">{status}</div>}

        <div className="call-controls">
          {!callActive ? (
            <button onClick={startCall} disabled={isConnecting} className="call-btn call-btn-start">
              <span className="call-btn-icon">{isConnecting ? '⏳' : '📞'}</span>
              <span className="call-btn-text">{isConnecting ? 'Connecting...' : 'Start Call'}</span>
            </button>
          ) : (
            <button onClick={endCall} className="call-btn call-btn-end">
              <span className="call-btn-icon">📵</span>
              <span className="call-btn-text">End Call</span>
            </button>
          )}
        </div>

        {conversationLog.length > 0 && (
          <details className="conversation-log">
            <summary className="log-summary">💬 Conversation ({conversationLog.length})</summary>
            <div className="log-entries">
              {conversationLog.map((entry, i) => (
                <div key={i} className={`log-entry ${entry.role === 'gemini' ? 'log-gemini' : 'log-user'}`}>
                  <span className="log-role">{entry.role === 'gemini' ? '🤖' : '🧑'}</span>
                  <span className="log-text">{entry.text}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
