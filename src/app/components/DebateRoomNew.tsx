"use client";

import { useState, useEffect, useCallback } from "react";
import { auth, db } from "../lib/firebase";
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
import { Box, Grid } from "@mui/material";

import DebateHeader from "./DebateHeader";
import PositionColumn from "./PositionColumn";
import ArgumentInput from "./ArgumentInput";
import DebateTimer from "./DebateTimer";

interface DebateRoomProps {
  debateId: string;
  onBack: () => void;
}

interface Argument {
  id: string;
  text: string;
  round: number;
  position: "a" | "b";
  aiScore?: number;
  authorId: string;
  timestamp: any;
}

interface Debate {
  id: string;
  topic: string;
  status: "waiting_for_players" | "ready_to_start" | "active" | "completed";
  participants: {
    a?: { uid: string; alias: string };
    b?: { uid: string; alias: string };
  };
  positionA: string;
  positionB: string;
  currentTurn?: string;
  round: number;
  maxRounds: number;
  roundTimeLimit: number;
  currentRoundTimeLeft?: number;
  roundStartedAt?: any;
  analysis?: {
    winner: "a" | "b" | "tie";
    aScore: number;
    bScore: number;
    summary: string;
  };
}

export default function DebateRoom({ debateId, onBack }: DebateRoomProps) {
  const [user] = useAuthState(auth);
  const [debate, setDebate] = useState<Debate | null>(null);
  const [debateArguments, setDebateArguments] = useState<Argument[]>([]);
  const [roundTimeLeft, setRoundTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [isSkippingTurn, setIsSkippingTurn] = useState(false);

  // Subscribe to debate changes
  useEffect(() => {
    const debateRef = doc(db, "debates", debateId);
    const unsubscribe = onSnapshot(debateRef, (doc) => {
      if (doc.exists()) {
        setDebate({ id: doc.id, ...doc.data() } as Debate);
      }
    });
    return unsubscribe;
  }, [debateId]);

  // Subscribe to arguments changes
  useEffect(() => {
    const argumentsRef = collection(db, "debates", debateId, "arguments");
    const q = query(argumentsRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const args: Argument[] = [];
      snapshot.forEach((doc) => {
        args.push({ id: doc.id, ...doc.data() } as Argument);
      });
      setDebateArguments(args);
    });
    return unsubscribe;
  }, [debateId]);

  // Get current user's position
  const getUserPosition = useCallback((): "a" | "b" | null => {
    if (!debate) return null;
    const currentUserId =
      user?.uid || localStorage.getItem(`debate_${debateId}_requestId`);
    if (!currentUserId) return null;

    if (debate.participants.a?.uid === currentUserId) return "a";
    if (debate.participants.b?.uid === currentUserId) return "b";
    return null;
  }, [debate, user, debateId]);

  // Check if it's current user's turn
  const isMyTurn = useCallback((): boolean => {
    if (!debate?.currentTurn) return false;
    const currentUserId =
      user?.uid || localStorage.getItem(`debate_${debateId}_requestId`);
    return currentUserId === debate.currentTurn;
  }, [debate, user, debateId]);

  // Get next turn
  const getNextTurn = useCallback((): string => {
    if (!debate || !debate.currentTurn) return "";
    const currentTurnPosition =
      debate.currentTurn === debate.participants.a?.uid ? "a" : "b";
    if (currentTurnPosition === "a") {
      return debate.participants.b?.uid || "";
    } else {
      return debate.participants.a?.uid || "";
    }
  }, [debate]);

  // Auto-skip turn when timer expires
  const autoSkipTurn = useCallback(async () => {
    if (!debate || !debate.currentTurn || isSkippingTurn) return;

    setIsSkippingTurn(true);
    console.log("⏰ Auto-skipping turn due to timeout");

    try {
      const currentUserPosition =
        debate.currentTurn === debate.participants.a?.uid ? "a" : "b";
      const currentParticipant = debate.participants[currentUserPosition];

      // Check if argument already exists to prevent duplicates
      const existingArgument = debateArguments.find(
        (arg) =>
          arg.position === currentUserPosition && arg.round === debate.round
      );

      if (existingArgument) {
        console.log("🚫 Skip cancelled - argument already exists");
        return;
      }

      if (currentParticipant) {
        // Create skip argument
        await addDoc(collection(db, "debates", debateId, "arguments"), {
          text: "[SKIPPED - Time expired]",
          authorId: currentParticipant.uid,
          authorName: currentParticipant.alias,
          authorAlias: currentParticipant.alias,
          position: currentUserPosition,
          timestamp: serverTimestamp(),
          round: debate.round,
          aiScore: 0,
          aiAnalysis: {
            reasoning: "Turn was automatically skipped due to time expiration.",
            strengths: [],
            weaknesses: ["Failed to respond within time limit"],
            logicalFallacies: [],
          },
        });
      }

      // Move to next turn
      const nextTurn = getNextTurn();
      const currentRoundArgs = debateArguments.filter(
        (arg) => arg.round === debate.round
      );
      const totalArgsAfterThis = currentRoundArgs.length + 1;

      let nextRound = debate.round;
      let finalNextTurn = nextTurn;

      // If both players have argued, advance to next round
      if (totalArgsAfterThis >= 2) {
        nextRound = debate.round + 1;
        finalNextTurn = debate.participants.a?.uid || "";
      }

      const isDebateComplete = nextRound > debate.maxRounds;

      await updateDoc(doc(db, "debates", debateId), {
        currentTurn: isDebateComplete ? null : finalNextTurn,
        round: nextRound,
        status: isDebateComplete ? "completed" : "active",
        currentRoundTimeLeft: isDebateComplete ? null : debate.roundTimeLimit,
        roundStartedAt: isDebateComplete ? null : serverTimestamp(),
      });

      console.log("✅ Turn auto-skipped successfully");
    } catch (error) {
      console.error("Error auto-skipping turn:", error);
    } finally {
      setIsSkippingTurn(false);
    }
  }, [debate, debateArguments, debateId, getNextTurn, isSkippingTurn]);

  // Submit argument
  const submitArgument = useCallback(
    async (argumentText: string) => {
      if (!debate || submitting) return;

      const currentUserId =
        user?.uid || localStorage.getItem(`debate_${debateId}_requestId`);
      if (!currentUserId) return;

      const userPosition = getUserPosition();
      if (!userPosition) return;

      setSubmitting(true);

      try {
        const userParticipant = debate.participants[userPosition];
        const argumentRef = await addDoc(
          collection(db, "debates", debateId, "arguments"),
          {
            text: argumentText,
            authorId: currentUserId,
            authorName: userParticipant?.alias || "Anonymous",
            authorAlias: userParticipant?.alias || "Anonymous",
            position: userPosition,
            timestamp: serverTimestamp(),
            round: debate.round,
          }
        );

        // Get AI scoring
        const response = await fetch("/api/score-argument", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            argument: argumentText,
            position: userPosition,
            topic: debate.topic,
            previousArguments: debateArguments
              .filter((arg) => arg.round <= debate.round)
              .map((arg) => ({ text: arg.text, position: arg.position })),
          }),
        });

        const result = await response.json();

        if (response.ok) {
          await updateDoc(
            doc(db, "debates", debateId, "arguments", argumentRef.id),
            {
              aiScore: result.score.score,
              aiAnalysis: {
                reasoning: result.score.reasoning,
                strengths: result.score.strengths,
                weaknesses: result.score.weaknesses,
                logicalFallacies: result.score.logicalFallacies,
              },
            }
          );
        } else {
          await updateDoc(
            doc(db, "debates", debateId, "arguments", argumentRef.id),
            {
              aiScore: 0,
              aiAnalysis: {
                reasoning: `AI Scoring Error: ${result.error || "Unknown error"}`,
                strengths: ["Argument submitted (AI scoring failed)"],
                weaknesses: ["AI scoring failed"],
                logicalFallacies: [],
              },
            }
          );
        }

        // Update turn
        const currentRoundArgs = debateArguments.filter(
          (arg) => arg.round === debate.round
        );
        const totalArgsAfterThis = currentRoundArgs.length + 1;

        let nextRound = debate.round;
        let nextTurn = getNextTurn();

        if (totalArgsAfterThis >= 2) {
          nextRound = debate.round + 1;
          nextTurn = debate.participants.a?.uid || "";
        }

        const isDebateComplete = nextRound > debate.maxRounds;

        await updateDoc(doc(db, "debates", debateId), {
          currentTurn: isDebateComplete ? null : nextTurn,
          round: nextRound,
          status: isDebateComplete ? "completed" : "active",
          currentRoundTimeLeft: isDebateComplete
            ? null
            : debate.roundTimeLimit,
          roundStartedAt: isDebateComplete ? null : serverTimestamp(),
        });

        console.log("✅ Argument submitted successfully");
      } catch (error) {
        console.error("Error submitting argument:", error);
      } finally {
        setSubmitting(false);
      }
    },
    [debate, debateArguments, getUserPosition, getNextTurn, user, debateId, submitting]
  );

  // Show results modal when debate completes
  useEffect(() => {
    if (debate?.status === "completed" && debate.analysis) {
      setShowResultsModal(true);
    }
  }, [debate?.status, debate?.analysis]);

  if (!debate) {
    return <div>Loading...</div>;
  }

  if (debate.status !== "active" && debate.status !== "completed") {
    return <div>Debate not active</div>;
  }

  const userPosition = getUserPosition();
  if (!userPosition) {
    return <div>You are not a participant in this debate</div>;
  }

  return (
    <Box sx={{ maxWidth: "800px", mx: "auto" }}>
      <DebateTimer
        roundTimeLeft={roundTimeLeft}
        setRoundTimeLeft={setRoundTimeLeft}
        debate={debate}
        onTimeExpired={autoSkipTurn}
      />

      <DebateHeader
        status={debate.status}
        analysis={debate.analysis}
        participants={debate.participants}
        roundTimeLeft={roundTimeLeft}
        onViewDetails={() => setShowResultsModal(true)}
      />

      <Grid container spacing={3}>
        <Grid size={6}>
          <PositionColumn
            position="a"
            participantName={debate.participants.a?.alias || "Position A"}
            arguments={debateArguments}
          />
        </Grid>
        <Grid size={6}>
          <PositionColumn
            position="b"
            participantName={debate.participants.b?.alias || "Position B"}
            arguments={debateArguments}
          />
        </Grid>
      </Grid>

      {debate.status === "active" && (
        <ArgumentInput
          isMyTurn={isMyTurn()}
          currentRound={debate.round}
          userPosition={userPosition}
          positionStatement={
            userPosition === "a" ? debate.positionA : debate.positionB
          }
          roundTimeLeft={roundTimeLeft}
          onSubmit={submitArgument}
          submitting={submitting}
        />
      )}

      {/* TODO: Add ResultsModal component */}
    </Box>
  );
}