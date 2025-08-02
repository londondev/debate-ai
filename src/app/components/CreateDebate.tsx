"use client";

import { useState } from "react";
import { auth, db } from "@/app/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

interface CreateDebateProps {
  onDebateCreated: (debateId: string, topic: string) => void;
}

export default function CreateDebate({ onDebateCreated }: CreateDebateProps) {
  const [user] = useAuthState(auth);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateDebate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !topic.trim()) return;

    setLoading(true);
    try {
      const debateRef = await addDoc(collection(db, "debates"), {
        topic: topic.trim(),
        positionA: "", // Will be set in debate room
        positionB: "", // Will be set in debate room
        creatorId: user.uid,
        creatorName: user.displayName,
        isPublic: true, // Default to public
        status: "setup", // New status for setting up positions
        participants: {},
        joinRequests: {}, // Initialize empty join requests
        createdAt: serverTimestamp(),
        timeLimit: 20 * 60, // 20 minutes total debate time
        roundTimeLimit: 2 * 60, // 2 minutes per round
        isExtended: false,
        currentTurn: null,
        currentRoundTimeLeft: null,
        roundStartedAt: null,
        round: 0,
        maxRounds: 5, // 5 rounds each as specified
      });

      console.log("✅ Debate created:", debateRef.id);
      onDebateCreated(debateRef.id, topic.trim());
      setTopic("");
    } catch (error) {
      console.error("Error creating debate:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <p className="text-gray-600">Please sign in to create a debate</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">Start a Debate</h2>

      <form onSubmit={handleCreateDebate} className="space-y-6">
        {/* Topic Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What do you want to debate about?
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., What is the greatest football team of all time?"
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            maxLength={200}
            required
          />
          <p className="text-sm text-gray-500 mt-2">
            {topic.length}/200 characters
          </p>
        </div>

        {/* Create Button */}
        <button
          type="submit"
          disabled={loading || !topic.trim()}
          className="w-full bg-blue-500 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Creating Debate..." : "Create Debate 🚀"}
        </button>

        <p className="text-sm text-gray-600 text-center">
          You&apos;ll set up the debate positions in the next step
        </p>
      </form>
    </div>
  );
}
