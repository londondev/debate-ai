"use client";

import { useState } from "react";
import AuthButton from "./components/AuthButton";
import CreateDebate from "./components/CreateDebate";
import DebateRoom from "./components/DebateRoom";

export default function Home() {
  const [currentDebateId, setCurrentDebateId] = useState<string | null>(null);

  if (currentDebateId) {
    return (
      <DebateRoom
        debateId={currentDebateId}
        onBack={() => setCurrentDebateId(null)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">DebateAI</h1>
          <p className="text-xl text-gray-600 mb-8">
            Settle Every Argument with AI-Powered Debates
          </p>

          {/* Firebase Auth Test */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">
              🧪 Firebase Connection Test
            </h2>
            <AuthButton />
          </div>

          {/* Create Debate */}
          <div className="mb-8">
            <CreateDebate
              onDebateCreated={(debateId) => {
                console.log("Debate created with ID:", debateId);
                setCurrentDebateId(debateId);
              }}
            />
          </div>

          {/* Coming Soon Features */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold mb-2">AI Moderation</h3>
              <p className="text-gray-600">
                Real-time scoring and fact-checking
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">Fast Debates</h3>
              <p className="text-gray-600">Time-limited responses</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-4xl mb-4">☕</div>
              <h3 className="text-xl font-semibold mb-2">Coffee Fee</h3>
              <p className="text-gray-600">$1.99 to extend debates</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
