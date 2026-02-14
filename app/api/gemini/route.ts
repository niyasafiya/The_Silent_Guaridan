import { NextRequest, NextResponse } from 'next/server';
import {
  initializeGeminiSession,
  sendAudioToGemini,
  closeGeminiSession,
  isSessionActive,
} from '@/app/lib/gemini-handler';

export async function POST(request: NextRequest) {
  try {
    const { action, audio } = await request.json();

    // ── INIT ──
    if (action === 'init') {
      if (!isSessionActive()) {
        await initializeGeminiSession();
        // Give WebSocket a moment to open
        await new Promise((r) => setTimeout(r, 800));
      }
      return NextResponse.json({
        success: true,
        active: isSessionActive(),
      });
    }

    // ── PROCESS AUDIO ──
    if (action === 'process' && audio) {
      if (!isSessionActive()) {
        return NextResponse.json(
          { error: 'Session not active. Call init first.' },
          { status: 400 }
        );
      }

      const sampleRate = 16000;
      const response = await sendAudioToGemini(audio, `audio/pcm;rate=${sampleRate}`);

      if (response.error) {
        return NextResponse.json({ error: response.error }, { status: 500 });
      }

      // Check for emergency in text response
      const emergency = detectEmergency(response.text || '');

      return NextResponse.json({
        success: true,
        emergency,
        geminiText: response.text || '',
        geminiAudio: response.audioBase64 || '',
        audioMimeType: response.mimeType || '',
      });
    }

    // ── CLOSE ──
    if (action === 'close') {
      await closeGeminiSession();
      return NextResponse.json({ success: true });
    }

    // ── STATUS ──
    if (action === 'status') {
      return NextResponse.json({
        active: isSessionActive(),
      });
    }

    return NextResponse.json(
      { error: 'Invalid action: ' + action },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + String(error) },
      { status: 500 }
    );
  }
}

function detectEmergency(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Primary: check for the machine-readable trigger from system prompt
  if (lower.includes('emergency_detected')) return true;

  // Secondary: keyword fallback
  const emergencyPatterns = [
    'emergency',
    'call 911',
    'call 112',
    'need help',
    'in danger',
    'being attacked',
    'someone is hurt',
  ];

  return emergencyPatterns.some((p) => lower.includes(p));
}
