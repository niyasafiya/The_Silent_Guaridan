"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [time, setTime] = useState(0);
  const [danger, setDanger] = useState(false);

  // 🎤 Recording Function
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });

        const formData = new FormData();
        formData.append("audio", blob);

        const response = await fetch("http://localhost:5000/process", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        // 🗣 Speak Gemini reply
        const utterance = new SpeechSynthesisUtterance(data.reply);
        speechSynthesis.speak(utterance);

        // 🚨 If emergency detected
        if (data.danger) {
          setDanger(true);
        }
      };

      mediaRecorder.start();

      // Stop after 5 seconds
      setTimeout(() => {
        mediaRecorder.stop();
      }, 5000);

    } catch (error) {
      alert("Microphone permission denied ❌");
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      
      <h1 className="text-3xl font-bold mb-4">
        SilentGuardian AI
      </h1>

      <p className="text-gray-400">
        Call Time: {Math.floor(time / 60)}:
        {String(time % 60).padStart(2, "0")}
      </p>

      {/* 🎤 Recording Button */}
      <button
        onClick={startRecording}
        className="mt-6 bg-blue-600 px-6 py-3 rounded-full text-lg font-bold hover:bg-blue-700"
      >
        🎤 Start Recording
      </button>

      <a
        href="tel:112"
        className="mt-10 bg-red-600 px-8 py-4 rounded-full text-xl font-bold hover:bg-red-700"
      >
        🚨 Call 112
      </a>

      {/* 🚨 Emergency Overlay */}
      {danger && (
        <div className="fixed inset-0 bg-red-700 flex items-center justify-center text-white text-3xl font-bold">
          🚨 EMERGENCY DETECTED 🚨
        </div>
      )}
    </div>
  );
}

