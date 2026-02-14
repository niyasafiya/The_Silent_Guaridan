# 🛡️ The Silent Guardian

### 📖 Project Description
**The Silent Guardian** is a proactive AI safety companion designed to provide security in high-risk situations. Unlike passive recorders, this app uses real-time audio analysis to detect immediate danger. [cite_start]By leveraging the **Gemini 2.5 Native Audio** model, the system identifies distress signals—such as screams, shouting, or long periods of suspicious silence—and automatically triggers emergency UI protocols and simulated SOS calls to ensure help is on the way even if the user cannot reach their phone[cite: 11, 51, 137].

---

### 🛠️ Tech Stack
* [cite_start]**Frontend:** Next.js 16 (TypeScript) [cite: 12, 138]
* [cite_start]**Backend:** Flask (Python) [cite: 12, 138]
* [cite_start]**AI Engine:** Google Gemini 2.5 Flash Native Audio Preview [cite: 12, 52]
* [cite_start]**Styling:** Tailwind CSS [cite: 52]
* [cite_start]**Real-time Processing:** Web Audio API & MediaRecorder [cite: 12]

---

### ✨ Features
* [cite_start]**Native Audio Intelligence:** Directly processes raw audio through Gemini's native multimodal capabilities for high-accuracy distress detection[cite: 13, 53, 139].
* [cite_start]**Automated Emergency UI:** Instantly transitions to a high-visibility, pulsing red emergency state upon detection of a threat[cite: 13, 53, 139].
* [cite_start]**Suspicious Silence Monitoring:** Implements a watchdog timer that triggers alerts if a user goes silent for more than 20 seconds during an active call[cite: 13, 53].
* [cite_start]**One-Touch SOS Integration:** Includes a simulated auto-dialer to local emergency services (112) for immediate response[cite: 13, 139].

---

### 🚀 Installation Commands
Follow these steps to set up the project locally:

**1. Clone the repository**
```bash
git clone [https://github.com/your-username/the-silent-guardian.git](https://github.com/your-username/the-silent-guardian.git)
cd the-silent-guardian

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install flask flask-cors google-genai python-dotenv

### backend
cd frontend
# In the /voice-assistant folder
npm run dev

### AI Tools Used
Gemini 2.5 Flash: Used for real-time audio distress reasoning.
Gemini Live Chat: Assisted in debugging CORS connectivity and React state logic

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Screenshots of Project](https://drive.google.com/drive/folders/13reboBmi6b9jQVylBIywMklp0VxlNO4z?usp=drive_link)
- [demo video link](https://youtu.be/ocAnYbf7Sjo) - interactive web ui

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
