"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

interface CreateDebateProps {
  onDebateCreated: (debateId: string) => void;
}

export default function CreateDebate({ onDebateCreated }: CreateDebateProps) {
  const [user] = useAuthState(auth);
  const [topic, setTopic] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [position, setPosition] = useState<"pro" | "con">("pro");
  const [loading, setLoading] = useState(false);

  const handleCreateDebate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !topic.trim()) return;

    setLoading(true);
    try {
      const debateRef = await addDoc(collection(db, "debates"), {
        topic: topic.trim(),
        creatorId: user.uid,
        creatorName: user.displayName,
        creatorPosition: position,
        isPublic,
        status: "waiting_for_opponent",
        participants: {
          [position]: {
            uid: user.uid,
            name: user.displayName,
            photoURL: user.photoURL,
            position,
          },
        },
        createdAt: serverTimestamp(),
        timeLimit: 15 * 60, // 15 minutes in seconds
        isExtended: false,
        currentTurn: null,
        round: 0,
        maxRounds: 3,
      });

      console.log("✅ Debate created:", debateRef.id);
      onDebateCreated(debateRef.id);
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
      <h2 className="text-2xl font-bold mb-6">Create New Debate</h2>

      <form onSubmit={handleCreateDebate} className="space-y-6">
        {/* Topic Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Debate Topic
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Should artificial intelligence replace human teachers?"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={200}
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            {topic.length}/200 characters
          </p>
        </div>

        {/* Position Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Position
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setPosition("pro")}
              className={`p-4 border-2 rounded-lg transition-all ${
                position === "pro"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 hover:border-green-300"
              }`}
            >
              <div className="text-2xl mb-2">👍</div>
              <div className="font-semibold">Pro (For)</div>
              <div className="text-sm text-gray-600">Support the topic</div>
            </button>

            <button
              type="button"
              onClick={() => setPosition("con")}
              className={`p-4 border-2 rounded-lg transition-all ${
                position === "con"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-gray-200 hover:border-red-300"
              }`}
            >
              <div className="text-2xl mb-2">👎</div>
              <div className="font-semibold">Con (Against)</div>
              <div className="text-sm text-gray-600">
                Argue against the topic
              </div>
            </button>
          </div>
        </div>

        {/* Public/Private Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Debate Type
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`p-4 border-2 rounded-lg transition-all ${
                isPublic
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-blue-300"
              }`}
            >
              <div className="text-2xl mb-2">🌐</div>
              <div className="font-semibold">Public</div>
              <div className="text-sm text-gray-600">Others can watch live</div>
            </button>

            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`p-4 border-2 rounded-lg transition-all ${
                !isPublic
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-200 hover:border-purple-300"
              }`}
            >
              <div className="text-2xl mb-2">🔒</div>
              <div className="font-semibold">Private</div>
              <div className="text-sm text-gray-600">Invite friends only</div>
            </button>
          </div>
        </div>

        {/* Create Button */}
        <button
          type="submit"
          disabled={loading || !topic.trim()}
          className="w-full bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating Debate..." : "Create Debate Room"}
        </button>
      </form>
    </div>
  );
}
