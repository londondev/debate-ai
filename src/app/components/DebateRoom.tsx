"use client";

import { useState, useEffect } from "react";
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
import {
  Button,
  TextField,
  Card,
  CardContent,
  Typography,
  Grid,
  Checkbox,
  FormControlLabel,
  Box,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface DebateRoomProps {
  debateId: string;
  onBack: () => void;
}

interface Participant {
  uid: string;
  name: string;
  alias: string;
  photoURL: string;
  position: "a" | "b";
}

interface Argument {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorAlias: string;
  position: "a" | "b";
  timestamp: any;
  round: number;
  aiScore?: number;
  aiAnalysis?: {
    reasoning: string;
    strengths: string[];
    weaknesses: string[];
    logicalFallacies: string[];
  };
}

interface Debate {
  id: string;
  topic: string;
  positionA: string;
  positionB: string;
  participants: Record<string, Participant>;
  status: string;
  currentTurn: string | null;
  round: number;
  maxRounds: number;
  timeLimit: number;
  isExtended: boolean;
  createdAt: any;
  creatorId: string;
}

export default function DebateRoom({ debateId, onBack }: DebateRoomProps) {
  const [user] = useAuthState(auth);
  const [debate, setDebate] = useState<Debate | null>(null);
  const [debateArguments, setDebateArguments] = useState<Argument[]>([]);
  const [currentArgument, setCurrentArgument] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Setup state
  const [userAlias, setUserAlias] = useState("");
  const [positionAStatement, setPositionAStatement] = useState("");
  const [positionBStatement, setPositionBStatement] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Subscribe to debate updates
  useEffect(() => {
    if (!debateId) return;

    const debateRef = doc(db, "debates", debateId);
    const unsubscribe = onSnapshot(debateRef, (doc) => {
      if (doc.exists()) {
        const debateData = { id: doc.id, ...doc.data() } as Debate;
        setDebate(debateData);
        setTimeLeft(debateData.timeLimit || 900);

        // Load existing position statements
        if (debateData.positionA) setPositionAStatement(debateData.positionA);
        if (debateData.positionB) setPositionBStatement(debateData.positionB);
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

  // Initialize user alias with default - but don't override if user has typed something
  useEffect(() => {
    if (user && userAlias === "") {
      const participantCount = Object.keys(debate?.participants || {}).length;
      setUserAlias(`User ${participantCount + 1}`);
    }
  }, [user, debate]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || !debate || debate.status !== "active") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, debate]);

  const joinDebateSimple = async () => {
    if (!user || !userAlias.trim() || !debate) return;

    try {
      // Determine available position
      const availablePosition = !debate.participants.a ? "a" : "b";

      // Get the position statement for this user
      const positionStatement =
        availablePosition === "a" ? positionAStatement : positionBStatement;
      if (!positionStatement.trim()) return;

      const updatedParticipants = {
        ...debate.participants,
        [availablePosition]: {
          uid: user.uid,
          name: user.displayName,
          alias: userAlias.trim(),
          photoURL: user.photoURL,
          position: availablePosition,
        },
      };

      const bothPlayersJoined = Object.keys(updatedParticipants).length === 2;

      await updateDoc(doc(db, "debates", debateId), {
        [`participants.${availablePosition}`]: {
          uid: user.uid,
          name: user.displayName,
          alias: userAlias.trim(),
          photoURL: user.photoURL,
          position: availablePosition,
        },
        [`position${availablePosition.toUpperCase()}`]:
          positionStatement.trim(),
        isPublic: isPublic,
        status: bothPlayersJoined ? "ready_to_start" : "waiting_for_players",
      });

      console.log(`✅ Joined as Position ${availablePosition.toUpperCase()}`);
    } catch (error) {
      console.error("Error joining debate:", error);
    }
  };

  const startDebate = async () => {
    if (!debate || Object.keys(debate.participants).length < 2) return;

    try {
      const firstPlayer = Object.values(debate.participants)[0];
      await updateDoc(doc(db, "debates", debateId), {
        status: "active",
        currentTurn: firstPlayer.uid,
        round: 1,
      });
      console.log("✅ Debate started!");
    } catch (error) {
      console.error("Error starting debate:", error);
    }
  };

  const submitArgument = async () => {
    if (!user || !debate || !currentArgument.trim() || submitting) return;

    const userPosition = getUserPosition();
    if (!userPosition) return;

    setSubmitting(true);

    try {
      const userParticipant = debate.participants[userPosition];
      const argumentRef = await addDoc(
        collection(db, "debates", debateId, "arguments"),
        {
          text: currentArgument.trim(),
          authorId: user.uid,
          authorName: user.displayName,
          authorAlias: userParticipant?.alias || user.displayName,
          position: userPosition,
          timestamp: serverTimestamp(),
          round: debate.round,
        }
      );

      // Get previous arguments for context
      const previousArgs = debateArguments
        .filter((arg) => arg.round <= debate.round)
        .map((arg) => ({ text: arg.text, position: arg.position }));

      // Call AI scoring API
      const response = await fetch("/api/score-argument", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          argument: currentArgument.trim(),
          position: userPosition,
          topic: debate.topic,
          previousArguments: previousArgs,
        }),
      });

      const result = await response.json();
      const aiScore = result.score;

      // Update the argument with AI analysis
      await updateDoc(
        doc(db, "debates", debateId, "arguments", argumentRef.id),
        {
          aiScore: aiScore.score,
          aiAnalysis: {
            reasoning: aiScore.reasoning,
            strengths: aiScore.strengths,
            weaknesses: aiScore.weaknesses,
            logicalFallacies: aiScore.logicalFallacies,
          },
        }
      );

      // Update debate turn
      const nextTurn = getNextTurn();
      const nextRound = shouldAdvanceRound() ? debate.round + 1 : debate.round;

      await updateDoc(doc(db, "debates", debateId), {
        currentTurn: nextTurn,
        round: nextRound,
        status: nextRound > debate.maxRounds ? "completed" : "active",
      });

      setCurrentArgument("");
      console.log("✅ Argument submitted and scored:", aiScore.score);
    } catch (error) {
      console.error("Error submitting argument:", error);
      alert("Failed to submit argument. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getUserPosition = (): "a" | "b" | null => {
    if (!user || !debate) return null;

    if (debate.participants.a?.uid === user.uid) return "a";
    if (debate.participants.b?.uid === user.uid) return "b";
    return null;
  };

  const getNextTurn = (): string => {
    if (!debate || !user) return "";

    const currentUserPosition = getUserPosition();
    if (currentUserPosition === "a") {
      return debate.participants.b?.uid || "";
    } else {
      return debate.participants.a?.uid || "";
    }
  };

  const shouldAdvanceRound = (): boolean => {
    if (!debate) return false;

    const currentRoundArgs = debateArguments.filter(
      (arg) => arg.round === debate.round
    );
    return currentRoundArgs.length >= 2;
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
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
        }}
      >
        <Typography variant="h6">Loading debate...</Typography>
      </Box>
    );
  }

  if (!debate) {
    return (
      <Box sx={{ textAlign: "center" }}>
        <Typography variant="h6" color="error" sx={{ mb: 2 }}>
          Debate not found
        </Typography>
        <Button variant="contained" onClick={onBack}>
          Go Back
        </Button>
      </Box>
    );
  }

  const userPosition = getUserPosition();
  const canJoin = !userPosition;
  const isCreator = user?.uid === debate?.creatorId;
  const bothPlayersJoined =
    debate && Object.keys(debate.participants).length === 2;
  const positionsSet = debate?.positionA && debate?.positionB;

  return (
    <Box sx={{ maxWidth: "1200px", mx: "auto", p: 3 }}>
      {/* Back Button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        sx={{ mb: 3, color: "primary.main" }}
      >
        Back
      </Button>

      {/* Setup Interface */}
      {(debate.status === "setup" ||
        debate.status === "waiting_for_players" ||
        debate.status === "ready_to_start") && (
        <Card sx={{ p: 4, maxWidth: "900px", mx: "auto" }}>
          <CardContent>
            {/* Debate Title */}
            <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
              <Typography
                variant="h5"
                align="center"
                sx={{ fontWeight: "medium" }}
              >
                {debate.topic}
              </Typography>
            </Card>

            {/* Position Inputs */}
            <Grid container spacing={4} sx={{ mb: 3 }}>
              <Grid size={6}>
                <Card
                  variant="outlined"
                  sx={{
                    minHeight: "80px",
                    display: "flex",
                    alignItems: "center",
                    p: 0,
                  }}
                >
                  <input
                    type="text"
                    placeholder="My position placeholder"
                    value={
                      !userPosition
                        ? !debate.participants.a
                          ? positionAStatement
                          : positionBStatement
                        : userPosition === "a"
                        ? positionAStatement
                        : positionBStatement
                    }
                    onChange={(e) => {
                      if (!userPosition) {
                        if (!debate.participants.a) {
                          setPositionAStatement(e.target.value);
                        } else {
                          setPositionBStatement(e.target.value);
                        }
                      }
                    }}
                    disabled={!!userPosition}
                    maxLength={100}
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: "80px",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      textAlign: "center",
                      fontSize: "1.2rem",
                      padding: "20px",
                      fontFamily: "inherit",
                    }}
                  />
                </Card>
              </Grid>
              <Grid size={6}>
                <Card
                  variant="outlined"
                  sx={{
                    bgcolor: "grey.50",
                    minHeight: "80px",
                    display: "flex",
                    alignItems: "center",
                    p: 0,
                  }}
                >
                  <input
                    type="text"
                    placeholder="Other position placeholder"
                    value={
                      !userPosition
                        ? !debate.participants.a
                          ? positionBStatement
                          : positionAStatement
                        : userPosition === "a"
                        ? positionBStatement
                        : positionAStatement
                    }
                    disabled
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: "80px",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      textAlign: "center",
                      fontSize: "1.2rem",
                      padding: "20px",
                      color: "#999",
                      fontFamily: "inherit",
                    }}
                  />
                </Card>
              </Grid>
            </Grid>

            {/* Alias Inputs */}
            <Grid container spacing={4} sx={{ mb: 3 }}>
              <Grid size={6}>
                <Card
                  variant="outlined"
                  sx={{
                    minHeight: "80px",
                    display: "flex",
                    alignItems: "center",
                    p: 0,
                  }}
                >
                  <input
                    type="text"
                    placeholder="My Alias"
                    value={userAlias}
                    onChange={(e) => setUserAlias(e.target.value)}
                    maxLength={50}
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: "80px",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      textAlign: "center",
                      fontSize: "1.2rem",
                      padding: "20px",
                      fontFamily: "inherit",
                    }}
                  />
                </Card>
              </Grid>
              <Grid size={6}>
                <Card
                  variant="outlined"
                  sx={{
                    bgcolor: "grey.50",
                    minHeight: "80px",
                    display: "flex",
                    alignItems: "center",
                    p: 0,
                  }}
                >
                  <input
                    type="text"
                    placeholder="Other user alias"
                    value={
                      userPosition === "a"
                        ? debate.participants.b?.alias || ""
                        : debate.participants.a?.alias || ""
                    }
                    disabled
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: "80px",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      textAlign: "center",
                      fontSize: "1.2rem",
                      padding: "20px",
                      color: "#999",
                      fontFamily: "inherit",
                    }}
                  />
                </Card>
              </Grid>
            </Grid>

            {/* Public Debate Toggle */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
              }
              label="Public Debate"
              sx={{ mb: 3 }}
            />

            {/* Join/Start Button */}
            <Box sx={{ textAlign: "center", mb: 3 }}>
              {!userPosition ? (
                <Card variant="outlined" sx={{ p: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    onClick={joinDebateSimple}
                    disabled={
                      !userAlias.trim() ||
                      (!debate.participants.a && !positionAStatement.trim()) ||
                      (debate.participants.a && !positionBStatement.trim())
                    }
                    sx={{
                      fontSize: "1.1rem",
                      fontWeight: "medium",
                      textTransform: "none",
                    }}
                  >
                    Join Debate
                  </Button>
                </Card>
              ) : !bothPlayersJoined ? (
                <Typography variant="h6" color="text.secondary">
                  Waiting Opponent....
                </Typography>
              ) : (
                <Card variant="outlined" sx={{ p: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    onClick={startDebate}
                    sx={{
                      fontSize: "1.1rem",
                      fontWeight: "medium",
                      textTransform: "none",
                    }}
                  >
                    Start Debate
                  </Button>
                </Card>
              )}
            </Box>

            {/* Share Link */}
            {userPosition && !bothPlayersJoined && (
              <Box sx={{ textAlign: "center" }}>
                <Button
                  onClick={() =>
                    navigator.clipboard.writeText(window.location.href)
                  }
                  size="small"
                  sx={{ textTransform: "none" }}
                >
                  📋 Copy invite link
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Debate Interface */}
      {debate.status === "active" && (
        <Box>
          {/* Timer */}
          <Box sx={{ textAlign: "right", mb: 2 }}>
            <Typography
              variant="h4"
              color="error"
              sx={{ fontFamily: "monospace" }}
            >
              {formatTime(timeLeft)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Time Remaining
            </Typography>
          </Box>

          {/* Participants */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={6}>
              <Card sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h4">🅰️</Typography>
                <Typography variant="h6">Position A</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  "{debate.positionA}"
                </Typography>
                {debate.participants.a ? (
                  <Box>
                    <img
                      src={debate.participants.a.photoURL}
                      alt={debate.participants.a.name}
                      style={{ width: 32, height: 32, borderRadius: "50%" }}
                    />
                    <Typography variant="caption" sx={{ display: "block" }}>
                      {debate.participants.a.alias}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Waiting for player...
                  </Typography>
                )}
              </Card>
            </Grid>

            <Grid size={6}>
              <Card sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h4">🅱️</Typography>
                <Typography variant="h6">Position B</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  "{debate.positionB}"
                </Typography>
                {debate.participants.b ? (
                  <Box>
                    <img
                      src={debate.participants.b.photoURL}
                      alt={debate.participants.b.name}
                      style={{ width: 32, height: 32, borderRadius: "50%" }}
                    />
                    <Typography variant="caption" sx={{ display: "block" }}>
                      {debate.participants.b.alias}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Waiting for player...
                  </Typography>
                )}
              </Card>
            </Grid>
          </Grid>

          {/* Status */}
          <Card sx={{ p: 2, mb: 3, textAlign: "center" }}>
            <Typography variant="h6">
              Round {debate.round} of {debate.maxRounds} •{" "}
              {isMyTurn() ? "Your Turn!" : "Opponent's Turn"}
            </Typography>
          </Card>

          {/* Arguments */}
          <Card sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Arguments
            </Typography>
            {debateArguments.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography color="text.secondary">
                  No arguments yet. Be the first to make your case!
                </Typography>
              </Box>
            ) : (
              debateArguments.map((arg) => (
                <Card key={arg.id} sx={{ mb: 2, p: 2 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: "bold" }}>
                      {arg.authorAlias || arg.authorName} •{" "}
                      {arg.position === "a" ? "Position A" : "Position B"} •
                      Round {arg.round}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {arg.timestamp?.toDate?.()?.toLocaleTimeString() ||
                        "Just now"}
                    </Typography>
                  </Box>
                  <Typography sx={{ mb: 2 }}>{arg.text}</Typography>

                  {arg.aiScore !== undefined && (
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: "bold" }}
                        >
                          🤖 AI Analysis
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: "bold" }}
                        >
                          {arg.aiScore.toFixed(1)}/10
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {arg.aiAnalysis?.reasoning}
                      </Typography>
                    </Card>
                  )}
                </Card>
              ))
            )}
          </Card>

          {/* Input Area */}
          {userPosition && (
            <Card sx={{ p: 3 }}>
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
              >
                <Typography variant="h6">
                  {isMyTurn() ? "Your Turn" : "Wait for your turn"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {currentArgument.length}/500 characters
                </Typography>
              </Box>

              <TextField
                fullWidth
                multiline
                rows={4}
                value={currentArgument}
                onChange={(e) => setCurrentArgument(e.target.value)}
                placeholder={
                  isMyTurn()
                    ? "Type your argument here..."
                    : "Wait for your opponent..."
                }
                disabled={!isMyTurn()}
                inputProps={{ maxLength: 500 }}
                sx={{ mb: 2 }}
              />

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Round {debate.round} of {debate.maxRounds}
                </Typography>
                <Button
                  variant="contained"
                  onClick={submitArgument}
                  disabled={
                    !isMyTurn() || !currentArgument.trim() || submitting
                  }
                >
                  {submitting
                    ? "Submitting & AI Scoring..."
                    : "Submit Argument"}
                </Button>
              </Box>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
}
