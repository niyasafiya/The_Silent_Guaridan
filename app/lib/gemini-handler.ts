import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Session,
} from '@google/genai';

const responseQueue: LiveServerMessage[] = [];
let session: Session | undefined = undefined;
let sessionReady = false;
let aiClient: GoogleGenAI | undefined = undefined;

export interface GeminiResponse {
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  error?: string;
}

export async function initializeGeminiSession(): Promise<void> {
  // Close any existing session first
  if (session) {
    try { session.close(); } catch { /* ignore */ }
    session = undefined;
    sessionReady = false;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set');
  }

  console.log('[Gemini] Initializing session...');

  const ai = new GoogleGenAI({ apiKey });
  aiClient = ai;

  const model = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

  // Native audio model only supports AUDIO response modality
  const config = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: {
      parts: [
        {
          text: `You are a friendly AI companion on a phone call with the user. Have a natural, warm conversation. Keep your responses brief and conversational.

CRITICAL SAFETY ROLE: You are also a silent guardian. While chatting normally, continuously monitor the audio for:
- Screaming or shrieking
- Cries for help ("help me!", "somebody help!", etc.)
- Sounds of violence, breaking glass, crashes
- Panicked breathing or crying
- Any indication of physical distress or danger

If you detect danger, immediately say: "I'm detecting an emergency situation. Stay calm, I'm alerting emergency services now."

When there is NO emergency, just have a normal friendly conversation. Do NOT mention your safety monitoring role unless an emergency occurs.`,
        },
      ],
    },
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Zephyr',
        },
      },
    },
  };

  session = await ai.live.connect({
    model,
    callbacks: {
      onopen: function () {
        console.log('[Gemini] ✅ Session opened');
        sessionReady = true;
        responseQueue.length = 0;
      },
      onmessage: function (message: LiveServerMessage) {
        responseQueue.push(message);
      },
      onerror: function (e: ErrorEvent) {
        console.error('[Gemini] ❌ Error:', e.message);
        sessionReady = false;
      },
      onclose: function (e: CloseEvent) {
        console.log('[Gemini] Session closed:', e.reason);
        sessionReady = false;
        session = undefined;
      },
    },
    config,
  });

  console.log('[Gemini] ✅ Session created successfully');
}

export async function sendAudioToGemini(
  audioBase64: string,
  mimeType: string
): Promise<GeminiResponse> {
  if (!session || !sessionReady) {
    return { error: 'Session not initialized or not ready' };
  }

  try {
    // sendRealtimeInput requires real-time streaming behavior
    // We must chunk the 3-second buffer into smaller pieces (e.g., 100ms)
    // and send them with a slight delay to simulate a live stream
    const chunkSize = 3200; // 100ms at 16kHz (16000 * 0.1 * 2 bytes per sample? No, base64 is encoded)
    // Actually, let's just chunk the base64 string directly approx. every 1KB
    // A 3s clip at 16kHz 16-bit mono is 96KB raw.

    // Better approach: send the whole chunk but wait for VAD
    // The issue might be that we're sending a big blob and then immediately waiting
    // Let's try sending it in 5 chunks with 50ms delay

    const chunkCount = 5;
    const len = audioBase64.length;
    const charsPerChunk = Math.ceil(len / chunkCount);

    for (let i = 0; i < chunkCount; i++) {
      const chunk = audioBase64.slice(i * charsPerChunk, (i + 1) * charsPerChunk);
      session.sendRealtimeInput({
        media: {
          data: chunk,
          mimeType,
        },
      });
      // Tiny delay to simulate streaming
      await new Promise(r => setTimeout(r, 20));
    }

    // Send a text signal that we are done talking, to trigger the model response immediately
    // usage of turnComplete is implicit in the Live API when VAD detects silence.

    console.log('[Gemini] 📤 Audio chunks sent');

    // Wait for response
    const response = await handleTurn();
    return response;
  } catch (error) {
    console.error('[Gemini] Error sending audio:', error);
    return { error: String(error) };
  }
}

/**
 * Analyze user audio for emergency using the standard (non-live) Gemini API.
 * This runs in parallel with the live audio conversation.
 */
export async function analyzeAudioForEmergency(
  audioBase64: string,
  mimeType: string
): Promise<{ emergency: boolean; analysis: string }> {
  if (!aiClient) {
    return { emergency: false, analysis: '' };
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: `Analyze this audio clip. Is there any sign of emergency, distress, violence, screaming, or cries for help?

Respond with ONLY one of these two formats:
- "SAFE: [brief description]" if everything sounds normal
- "EMERGENCY: [brief description]" if there are signs of danger or distress

Be conservative - only flag as EMERGENCY if there are clear signs of danger.`,
            },
          ],
        },
      ],
    });

    const text = response?.text || '';
    const isEmergency = text.toUpperCase().startsWith('EMERGENCY');
    console.log('[Gemini-Analysis]', text);
    return { emergency: isEmergency, analysis: text };
  } catch (error) {
    console.error('[Gemini-Analysis] Error:', error);
    return { emergency: false, analysis: '' };
  }
}

async function handleTurn(): Promise<GeminiResponse> {
  let done = false;
  const response: GeminiResponse = {};
  const audioParts: string[] = [];
  const maxWaitTime = 15000;
  const startTime = Date.now();

  while (!done) {
    if (Date.now() - startTime > maxWaitTime) {
      console.warn('[Gemini] ⏱️ Timeout waiting for response');
      break;
    }

    const message = await waitMessage();
    if (!message) continue;

    // Process model turn parts
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part?.text) {
          response.text = (response.text || '') + part.text;
          console.log('[Gemini] 📝 Text:', part.text);
        }
        if (part?.inlineData) {
          audioParts.push(part.inlineData.data ?? '');
          if (!response.mimeType) {
            response.mimeType = part.inlineData.mimeType;
          }
        }
      }
    }

    if (message.serverContent?.turnComplete) {
      console.log('[Gemini] ✅ Turn complete');
      done = true;
    }
  }

  if (audioParts.length > 0) {
    response.audioBase64 = audioParts.join('');
  }

  console.log('[Gemini] Response:', {
    hasText: !!response.text,
    hasAudio: !!response.audioBase64,
    audioChunks: audioParts.length,
    mimeType: response.mimeType,
  });

  return response;
}

async function waitMessage(): Promise<LiveServerMessage | null> {
  let message: LiveServerMessage | undefined = undefined;
  let waitCount = 0;
  const maxWait = 300; // 15 seconds (300 * 50ms)

  while (waitCount < maxWait) {
    message = responseQueue.shift();
    if (message) return message;
    waitCount++;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
}

export async function closeGeminiSession(): Promise<void> {
  if (session) {
    try { session.close(); } catch { /* ignore */ }
    session = undefined;
  }
  sessionReady = false;
  responseQueue.length = 0;
}

export function isSessionActive(): boolean {
  return session !== undefined && sessionReady;
}
