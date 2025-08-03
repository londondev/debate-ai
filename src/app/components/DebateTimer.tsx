"use client";

import React, { useEffect } from "react";

interface DebateTimerProps {
  roundTimeLeft: number;
  setRoundTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  debate: {
    status: string;
    currentRoundTimeLeft?: number;
    roundStartedAt?: any;
    currentTurn?: string;
  };
  onTimeExpired: () => void;
}

export default function DebateTimer({
  roundTimeLeft,
  setRoundTimeLeft,
  debate,
  onTimeExpired,
}: DebateTimerProps) {
  // Round timer countdown
  useEffect(() => {
    if (
      !debate ||
      debate.status !== "active" ||
      !debate.currentRoundTimeLeft ||
      debate.currentRoundTimeLeft <= 0
    ) {
      setRoundTimeLeft(0);
      return;
    }

    // Calculate initial time left based on when round started
    let initialTimeLeft = debate.currentRoundTimeLeft;
    if (debate.roundStartedAt) {
      const startTime = (debate.roundStartedAt as { toDate?: () => Date })
        .toDate
        ? (debate.roundStartedAt as { toDate: () => Date }).toDate().getTime()
        : Date.now();
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      initialTimeLeft = Math.max(
        0,
        debate.currentRoundTimeLeft - elapsedSeconds
      );
    }

    setRoundTimeLeft(initialTimeLeft);

    // Set up interval timer
    const timer = setInterval(() => {
      setRoundTimeLeft((prev: number) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [
    debate?.currentRoundTimeLeft,
    debate?.roundStartedAt,
    debate?.currentTurn,
    debate?.status,
  ]);

  // Watch for timer expiration
  useEffect(() => {
    if (
      roundTimeLeft === 0 &&
      debate?.currentTurn &&
      debate?.status === "active"
    ) {
      onTimeExpired();
    }
  }, [roundTimeLeft, debate?.currentTurn, debate?.status, onTimeExpired]);

  // This component handles timer logic but doesn't render anything
  return null;
}