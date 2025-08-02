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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AuthButton from "./AuthButton";

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

interface JoinRequest {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  requestedAt: any;
  status: "pending" | "approved" | "denied";
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
  joinRequests?: Record<string, JoinRequest>;
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

  // Permission state
  const [showJoinRequestModal, setShowJoinRequestModal] = useState(false);
  const [joinRequestName, setJoinRequestName] = useState("");
  const [permissionStatus, setPermissionStatus] = useState<"checking" | "request_sent" | "approved" | "denied" | null>(null);

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

  // Check user permission when debate loads
  useEffect(() => {
    console.log("🔍 Permission check start:", { user: !!user, debate: !!debate });
    
    if (!debate) return;
    
    // Handle signed-in users
    if (user) {
      console.log("🔍 Permission check (signed-in user):", {
        userId: user.uid,
        creatorId: debate.creatorId,
        participants: debate.participants,
        joinRequests: debate.joinRequests
      });

      const isCreator = user.uid === debate.creatorId;
      const isParticipant = Object.values(debate.participants).some(p => p.uid === user.uid);
      
      console.log("👤 User status:", { isCreator, isParticipant });
      
      if (isCreator || isParticipant) {
        // User has access
        console.log("✅ User approved (creator or participant)");
        setPermissionStatus("approved");
        return;
      }

      // Check if user has pending/approved/denied request
      const existingRequest = debate.joinRequests?.[user.uid];
      console.log("📝 Existing request:", existingRequest);
      
      if (existingRequest) {
        console.log("📋 Setting status from existing request:", existingRequest.status);
        setPermissionStatus(existingRequest.status === "pending" ? "request_sent" : existingRequest.status);
        return;
      }
    } else {
      // Check for anonymous user requests in localStorage
      const storedRequestId = localStorage.getItem(`debate_${debateId}_requestId`);
      if (storedRequestId && debate.joinRequests?.[storedRequestId]) {
        const existingRequest = debate.joinRequests[storedRequestId];
        console.log("📝 Anonymous request found:", existingRequest);
        setPermissionStatus(existingRequest.status === "pending" ? "request_sent" : existingRequest.status);
        return;
      }
    }

    // For anonymous users or signed-in users without access
    // Check if debate is full (2 participants already)
    const participantCount = Object.keys(debate.participants).length;
    console.log("👥 Participant count:", participantCount);
    
    if (participantCount >= 2) {
      // Debate is full, deny access
      console.log("❌ Debate full, denying access");
      setPermissionStatus("denied");
      return;
    }

    // New user (anonymous or signed-in) needs to request permission
    console.log("🔔 New user, showing join modal");
    setShowJoinRequestModal(true);
    setPermissionStatus(null);
  }, [user, debate]);

  // Subscribe to join request updates for current user
  useEffect(() => {
    if (!user || !debate || !debate.joinRequests) return;

    const currentUserRequest = debate.joinRequests[user.uid];
    if (currentUserRequest && currentUserRequest.status !== "pending") {
      setPermissionStatus(currentUserRequest.status);
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

      const updateData: any = {
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
      };

      // Remove the join request since user is now joining
      if (debate.joinRequests?.[user.uid]) {
        updateData[`joinRequests.${user.uid}`] = null;
      }

      await updateDoc(doc(db, "debates", debateId), updateData);

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

  const requestJoinPermission = async () => {
    if (!debate || !joinRequestName.trim()) return;

    try {
      // Generate a unique ID for anonymous users
      const requestId = user?.uid || `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const joinRequest = {
        id: requestId,
        userId: requestId,
        userName: joinRequestName.trim(),
        userPhoto: user?.photoURL || "",
        requestedAt: serverTimestamp(),
        status: "pending" as const,
        isAnonymous: !user
      };

      // For existing debates without joinRequests field, initialize it
      const updateData: any = {};
      if (!debate.joinRequests) {
        updateData.joinRequests = {
          [requestId]: joinRequest
        };
      } else {
        updateData[`joinRequests.${requestId}`] = joinRequest;
      }

      await updateDoc(doc(db, "debates", debateId), updateData);

      // Store the request ID for anonymous users
      if (!user) {
        localStorage.setItem(`debate_${debateId}_requestId`, requestId);
      }

      setPermissionStatus("request_sent");
      setShowJoinRequestModal(false);
      console.log("✅ Join request sent");
    } catch (error) {
      console.error("Error sending join request:", error);
      alert("Failed to send join request. Please try again.");
    }
  };

  const handleJoinRequest = async (userId: string, action: "approve" | "deny") => {
    if (!debate) return;

    try {
      await updateDoc(doc(db, "debates", debateId), {
        [`joinRequests.${userId}.status`]: action === "approve" ? "approved" : "denied"
      });

      console.log(`✅ Join request ${action}d for user ${userId}`);
    } catch (error) {
      console.error(`Error ${action}ing join request:`, error);
    }
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

  // Handle permission states
  if (permissionStatus === "request_sent") {
    return (
      <Box sx={{ maxWidth: "600px", mx: "auto", p: 3, textAlign: "center" }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ mb: 3, alignSelf: "flex-start" }}
        >
          Back
        </Button>
        <Card sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Permission Request Sent
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Your request to join "{debate.topic}" has been sent to the creator. 
            Please wait for approval.
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <Typography variant="body2" color="primary">
              ⏳ Waiting for approval...
            </Typography>
          </Box>
        </Card>
      </Box>
    );
  }

  if (permissionStatus === "denied") {
    const participantCount = Object.keys(debate?.participants || {}).length;
    const isFull = participantCount >= 2;
    
    return (
      <Box sx={{ maxWidth: "600px", mx: "auto", p: 3, textAlign: "center" }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ mb: 3, alignSelf: "flex-start" }}
        >
          Back
        </Button>
        <Card sx={{ p: 4 }}>
          <Typography variant="h5" color="error" sx={{ mb: 2 }}>
            {isFull ? "Debate Full" : "Access Denied"}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {isFull 
              ? "This debate already has 2 participants and is full."
              : "The creator has denied your request to join this debate."
            }
          </Typography>
        </Card>
      </Box>
    );
  }


  // Don't show main UI until permission is resolved
  if (permissionStatus !== "approved" && permissionStatus !== null) {
    console.log("🔄 Showing permission check screen, status:", permissionStatus);
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
        }}
      >
        <Typography variant="h6">Checking permissions... (Status: {permissionStatus})</Typography>
      </Box>
    );
  }

  // Debug logging
  console.log("🎯 RENDER STATE:", {
    showJoinRequestModal,
    permissionStatus,
    user: user?.uid,
    debate: debate?.id
  });

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

      {/* Join Request Modal */}
      <Dialog open={showJoinRequestModal} onClose={() => setShowJoinRequestModal(false)}>
        <DialogTitle>Join Debate</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            You're about to request permission to join "{debate?.topic}". Please enter your name:
          </Typography>
          <TextField
            fullWidth
            label="Your Name"
            value={joinRequestName}
            onChange={(e) => setJoinRequestName(e.target.value)}
            placeholder="Enter your name"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowJoinRequestModal(false)}>Cancel</Button>
          <Button 
            onClick={requestJoinPermission} 
            variant="contained"
            disabled={!joinRequestName.trim()}
          >
            Send Request
          </Button>
        </DialogActions>
      </Dialog>

      {/* Creator's Join Request Approval UI */}
      {isCreator && debate?.joinRequests && Object.values(debate.joinRequests).some(req => req.status === "pending") && (
        <Card sx={{ position: "fixed", bottom: 20, right: 20, minWidth: 300, zIndex: 1000 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              🔔 Join Requests
            </Typography>
            <List dense>
              {Object.values(debate.joinRequests)
                .filter(req => req.status === "pending")
                .map((request) => (
                  <ListItem key={request.userId} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar src={request.userPhoto} alt={request.userName}>
                        {request.userName[0]}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={request.userName}
                      secondary="wants to join as debater"
                    />
                    <Box sx={{ ml: 1 }}>
                      <Button
                        size="small"
                        color="success"
                        onClick={() => handleJoinRequest(request.userId, "approve")}
                        sx={{ mr: 1 }}
                      >
                        ✓
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleJoinRequest(request.userId, "deny")}
                      >
                        ✗
                      </Button>
                    </Box>
                  </ListItem>
                ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
