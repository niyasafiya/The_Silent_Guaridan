# 🛡️ Silent Guardian - Setup & Usage Guide

## Quick Start

### 1️⃣ Get Your API Key
- Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
- Click "Create API Key"
- Copy your new API key

### 2️⃣ Configure API Key
```bash
# Edit .env.local file and add:
GEMINI_API_KEY=your_api_key_here
```

### 3️⃣ Start the App
```bash
npm run dev
```
Then open `http://localhost:3000` in your browser.

---

## Features Implemented ✨

### 🎤 Real-Time Audio Processing
- Continuous audio recording in 3-second chunks
- Sent to Google Gemini API for real-time responses
- Native audio processing with Gemini 2.5 Flash model

### 🚨 Emergency Detection (Multiple Triggers)
1. **Scream Detection**
   - High volume detection (RMS > 8000)
   - High-frequency pattern analysis (zero-crossing rate > 0.4)
   - Indicates distress or panic

2. **Silence Detection**
   - Monitors for extended quiet periods
   - Triggers after 20+ consecutive seconds of silence
   - Could indicate unconsciousness or distress

### 📞 Professional Call Interface
- Real phone app-like design
- Call timer showing duration
- Caller display with avatar
- Live status indicators
- Emergency alert overlay

### 🎯 Gemini Integration
- Simulates a friendly AI caller
- Engages in natural conversation
- Responds with audio via text-to-speech
- Named "Silent Guardian" with Zephyr voice

---

## How To Use

### Starting a Call
1. Click **"📞 Start Call"** button
2. Grant microphone access when prompted
3. Talk naturally with the AI assistant

### What Happens
- Audio is recorded and sent to backend
- Analyzed for emergencies
- Gemini responds with audio feedback
- Status updates show real-time analysis

### Emergency Triggers
The app will automatically trigger emergency response when:
- **Scream detected** - High volume + high frequency
- **Silence > 20 seconds** - User not responding
- A red alert screen appears
- Audio alarm plays
- Emergency calling interface activates

### Ending a Call
- Click **"📵 End Call"** button
- Session closes gracefully
- Returns to main screen

---

## Project Architecture 🏗️

### Frontend (`app/page.tsx`)
- React component with call interface
- Audio recording & streaming
- Real-time UI updates
- Emergency alert visualization

### Backend (`app/api/gemini/route.ts`)
- Handles Gemini session management
- Audio analysis for emergency detection
- RMS & zero-crossing rate calculations
- Speech synthesis for responses

### Gemini Handler (`app/lib/gemini-handler.ts`)
- Session management (init, send, close)
- Real-time audio streaming
- Message queue handling
- Response processing

---

## Audio Analysis Algorithms 🔬

### RMS (Root Mean Square)
- Measures audio volume/loudness
- Formula: √(Σ(x²) / N)
- **Low RMS < 1000**: Silence
- **High RMS > 8000**: Scream/Loud noise

### Zero-Crossing Rate (ZCR)
- Counts sign changes in audio signal
- Indicates frequency content
- **Low ZCR**: Low frequency (speech)
- **High ZCR > 0.4**: High frequency (screams)

### Combined Detection
- **Scream**: High RMS AND High ZCR
- **Silence**: Low RMS

---

## Environment Setup 🌐

### Required
- Node.js 18+
- Google Gemini API key
- Modern browser with:
  - MediaRecorder API
  - Web Audio API
  - Microphone access

### Optional (Production)
- HTTPS certificate
- Environment variable manager
- Logging service
- Error tracking

---

## File Structure 📁

```
voice-assistant/
├── app/
│   ├── api/
│   │   └── gemini/
│   │       └── route.ts          # API endpoint
│   ├── lib/
│   │   └── gemini-handler.ts     # Gemini session logic
│   ├── page.tsx                   # Main UI
│   ├── layout.tsx                 # Root layout
│   └── globals.css                # Tailwind styles
├── .env.local                      # API key (not in git)
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
└── README.md                       # Documentation
```

---

## Testing Emergency Detection 🧪

### Test Silence Detection
1. Start a call
2. Remain silent for 20+ seconds
3. Watch the silence counter increase
4. Emergency triggers when counter reaches 20

### Test Scream Detection
1. Start a call
2. Make a loud, high-pitched noise
3. System analyzes for scream patterns
4. Emergency triggers if pattern matches

### Test Normal Conversation
1. Start a call
2. Speak normally
3. Gemini responds conversationally
4. No emergency triggered (as expected)

---

## Troubleshooting 🔧

| Issue | Solution |
|-------|----------|
| Microphone denied | Check browser permissions, use HTTPS for production |
| No Gemini response | Verify API key is correct and has quota |
| High latency | Check internet connection, reduce audio chunk size |
| Audio not playing | Check browser audio permissions and volume |
| Emergency won't trigger | Test with louder sounds or check silence threshold |

---

## Security Notes 🔒

1. **Never commit `.env.local`** - Contains sensitive API key
2. **API key rotation** - Regularly update keys in production
3. **HTTPS required** - For microphone access in production
4. **Rate limiting** - Consider limiting API calls per session
5. **Input validation** - Sanitize audio before processing

---

## Next Steps 🚀

### Enhancements to Consider
- [ ] Add emergency services integration
- [ ] Implement call recording
- [ ] Add multiple voice options
- [ ] Create admin dashboard
- [ ] Add multi-language support
- [ ] Implement location tracking
- [ ] Add video support
- [ ] Create offline fallback

### Performance Optimization
- Reduce audio chunk size for faster detection
- Implement audio buffering
- Use Web Worker for analysis
- Add request caching

---

## Support & Documentation 📚

- [Google Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Web Audio API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

---

**Version**: 1.0.0
**Last Updated**: February 2026
**Status**: ✅ Ready for testing
