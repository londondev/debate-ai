"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import {
  doc,
  onSnapshot,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

interface DebateRoomProps {
  debateId: string;
  onBack: () => void;
}

interface Participant {
  uid: string;
  name: string;
  photoURL: string;
  position: "pro" | "con";
}

interface Argument {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  position: "pro" | "con";
  timestamp: any;
  round: number;
}

interface Debate {
  id: string;
  topic: string;
  participants: Record<string, Participant>;
  status: string;
  currentTurn: string | null;
  round: number;
  maxRounds: number;
  timeLimit: number;
  isExtended: boolean;
  createdAt: any;
}

export default function DebateRoom({ debateId, onBack }: DebateRoomProps) {
  const [user] = useAuthState(auth);
  const [debate, setDebate] = useState<Debate | null>(null);
  const [debateArguments, setDebateArguments] = useState<Argument[]>([]);
  const [currentArgument, setCurrentArgument] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  // Subscribe to debate updates
  useEffect(() => {
    if (!debateId) return;

    const debateRef = doc(db, "debates", debateId);
    const unsubscribe = onSnapshot(debateRef, (doc) => {
      if (doc.exists()) {
        setDebate({ id: doc.id, ...doc.data() } as Debate);
        setTimeLeft(doc.data().timeLimit || 900); // 15 minutes default
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [debateId]);

  // Subscribe to arguments
  useEffect(() => {
    if (!debateId) return;

    const argumentsRef = collection(db, "debates", debateId, "arguments");
    const q = query(argumentsRef, orderBy("timestamp"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const args: Argument[] = [];
      snapshot.forEach((doc) => {
        args.push({ id: doc.id, ...doc.data() } as Argument);
      });
      setDebateArguments(args);
    });

    return () => unsubscribe();
  }, [debateId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || !debate || debate.status !== "active") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up logic
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, debate]);

  const joinDebate = async () => {
    if (!user || !debate) return;

    // Determine which position is available
    const availablePosition = debate.participants.pro ? "con" : "pro";

    await updateDoc(doc(db, "debates", debateId), {
      [`participants.${availablePosition}`]: {
        uid: user.uid,
        name: user.displayName,
        photoURL: user.photoURL,
        position: availablePosition,
      },
      status: "active",
      currentTurn: debate.participants.pro
        ? debate.participants.pro.uid
        : user.uid,
      round: 1,
    });
  };

  const submitArgument = async () => {
    if (!user || !debate || !currentArgument.trim()) return;

    const userPosition = getUserPosition();
    if (!userPosition) return;

    try {
      // Add argument to subcollection
      await addDoc(collection(db, "debates", debateId, "arguments"), {
        text: currentArgument.trim(),
        authorId: user.uid,
        authorName: user.displayName,
        position: userPosition,
        timestamp: serverTimestamp(),
        round: debate.round,
      });

      // Update debate turn
      const nextTurn = getNextTurn();
      const nextRound = shouldAdvanceRound() ? debate.round + 1 : debate.round;

      await updateDoc(doc(db, "debates", debateId), {
        currentTurn: nextTurn,
        round: nextRound,
        status: nextRound > debate.maxRounds ? "completed" : "active",
      });

      setCurrentArgument("");
    } catch (error) {
      console.error("Error submitting argument:", error);
    }
  };

  const getUserPosition = (): "pro" | "con" | null => {
    if (!user || !debate) return null;

    if (debate.participants.pro?.uid === user.uid) return "pro";
    if (debate.participants.con?.uid === user.uid) return "con";
    return null;
  };

  const getNextTurn = (): string => {
    if (!debate || !user) return "";

    const currentUserPosition = getUserPosition();
    if (currentUserPosition === "pro") {
      return debate.participants.con?.uid || "";
    } else {
      return debate.participants.pro?.uid || "";
    }
  };

  const shouldAdvanceRound = (): boolean => {
    if (!debate) return false;

    const currentRoundArgs = debateArguments.filter(
      (arg) => arg.round === debate.round
    );
    return currentRoundArgs.length >= 2; // Both players have argued this round
  };

  const isMyTurn = (): boolean => {
    return user?.uid === debate?.currentTurn;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Loading debate...</div>
      </div>
    );
  }

  if (!debate) {
    return (
      <div className="text-center">
        <div className="text-xl text-red-600 mb-4">Debate not found</div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Go Back
        </button>
      </div>
    );
  }

  const userPosition = getUserPosition();
  const canJoin =
    !userPosition && (!debate.participants.pro || !debate.participants.con);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <button onClick={onBack} className="text-blue-500 hover:underline">
            ← Back to Home
          </button>
          <div className="text-right">
            <div className="text-2xl font-mono text-red-500">
              {formatTime(timeLeft)}
            </div>
            <div className="text-sm text-gray-600">Time Remaining</div>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-4">{debate.topic}</h1>

        <div className="grid grid-cols-2 gap-4">
          {/* Pro Participant */}
          <div
            className={`p-4 rounded-lg border-2 ${
              debate.participants.pro
                ? "border-green-500 bg-green-50"
                : "border-gray-200"
            }`}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">👍</div>
              <div className="font-semibold text-green-700">Pro Position</div>
              {debate.participants.pro ? (
                <div className="mt-2">
                  <img
                    src={debate.participants.pro.photoURL}
                    alt={debate.participants.pro.name}
                    className="w-8 h-8 rounded-full mx-auto mb-1"
                  />
                  <div className="text-sm">{debate.participants.pro.name}</div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 mt-2">
                  Waiting for player...
                </div>
              )}
            </div>
          </div>

          {/* Con Participant */}
          <div
            className={`p-4 rounded-lg border-2 ${
              debate.participants.con
                ? "border-red-500 bg-red-50"
                : "border-gray-200"
            }`}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">👎</div>
              <div className="font-semibold text-red-700">Con Position</div>
              {debate.participants.con ? (
                <div className="mt-2">
                  <img
                    src={debate.participants.con.photoURL}
                    alt={debate.participants.con.name}
                    className="w-8 h-8 rounded-full mx-auto mb-1"
                  />
                  <div className="text-sm">{debate.participants.con.name}</div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 mt-2">
                  Waiting for player...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="mt-4 text-center">
          {debate.status === "waiting_for_opponent" && (
            <div className="text-orange-600 font-semibold">
              Waiting for opponent to join...
            </div>
          )}
          {debate.status === "active" && (
            <div className="text-green-600 font-semibold">
              Round {debate.round} of {debate.maxRounds} •{" "}
              {isMyTurn() ? "Your Turn!" : "Opponent's Turn"}
            </div>
          )}
          {debate.status === "completed" && (
            <div className="text-blue-600 font-semibold">Debate Completed!</div>
          )}
        </div>
      </div>

      {/* Join Button */}
      {canJoin && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 text-center">
          <h3 className="text-xl font-semibold mb-4">Join this debate!</h3>
          <button
            onClick={joinDebate}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Join as {debate.participants.pro ? "Con (Against)" : "Pro (For)"}
          </button>
        </div>
      )}

      {/* Arguments */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Arguments</h3>
        <div className="space-y-4">
          {debateArguments.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No arguments yet. Be the first to make your case!
            </div>
          ) : (
            debateArguments.map((arg) => (
              <div
                key={arg.id}
                className={`p-4 rounded-lg ${
                  arg.position === "pro"
                    ? "bg-green-100 border-l-4 border-green-500"
                    : "bg-red-100 border-l-4 border-red-500"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-sm">
                    {arg.authorName} • {arg.position === "pro" ? "Pro" : "Con"}{" "}
                    • Round {arg.round}
                  </div>
                  <div className="text-xs text-gray-500">
                    {arg.timestamp?.toDate?.()?.toLocaleTimeString() ||
                      "Just now"}
                  </div>
                </div>
                <div className="text-gray-800">{arg.text}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Input Area */}
      {userPosition && debate.status === "active" && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">
              {isMyTurn() ? "Your Turn" : "Wait for your turn"}
            </h3>
            <div className="text-sm text-gray-600">
              {currentArgument.length}/500 characters
            </div>
          </div>

          <textarea
            value={currentArgument}
            onChange={(e) => setCurrentArgument(e.target.value)}
            placeholder={
              isMyTurn()
                ? "Type your argument here..."
                : "Wait for your opponent..."
            }
            disabled={!isMyTurn()}
            maxLength={500}
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />

          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600">
              Round {debate.round} of {debate.maxRounds}
            </div>
            <button
              onClick={submitArgument}
              disabled={!isMyTurn() || !currentArgument.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Argument
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
