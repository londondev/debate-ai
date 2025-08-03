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
  deleteField,
  type UpdateData,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
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
  isAnonymous?: boolean;
}

interface Argument {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorAlias: string;
  position: "a" | "b";
  timestamp: unknown;
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
  requestedAt: unknown;
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
  roundTimeLimit: number;
  currentRoundTimeLeft: number | null;
  roundStartedAt: unknown;
  isExtended: boolean;
  createdAt: unknown;
  creatorId: string;
  joinRequests?: Record<string, JoinRequest>;
  analysis?: {
    winner: "a" | "b" | "tie";
    aScore: number;
    bScore: number;
    summary: string;
    analyzedAt: unknown;
  };
}

export default function DebateRoom({ debateId, onBack }: DebateRoomProps) {
  const [user] = useAuthState(auth);
  const [debate, setDebate] = useState<Debate | null>(null);
  const [debateArguments, setDebateArguments] = useState<Argument[]>([]);
  const [currentArgument, setCurrentArgument] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [roundTimeLeft, setRoundTimeLeft] = useState(0);
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

  // Post-debate state
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [debateAnalysis, setDebateAnalysis] = useState<{winner: "a" | "b" | "tie"; aScore: number; bScore: number; summary: string} | null>(null);
  const [analyzingResults, setAnalyzingResults] = useState(false);

  // Reset permission state on mount (helpful during development)
  useEffect(() => {
    setPermissionStatus(null);
    setShowJoinRequestModal(false);
  }, [debateId]);

  // Development helper function
  const resetPermissionState = () => {
    localStorage.removeItem(`debate_${debateId}_requestId`);
    setPermissionStatus(null);
    setShowJoinRequestModal(false);
    console.log("🔄 Permission state reset for development");
  };

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
    console.log("🔍 Current user info:", { 
      userUid: user?.uid, 
      userEmail: user?.email,
      userDisplayName: user?.displayName 
    });
    
    if (!debate) return;
    
    console.log("🔍 Debate info:", {
      id: debate.id,
      creatorId: debate.creatorId,
      status: debate.status,
      participants: debate.participants,
      participantKeys: Object.keys(debate.participants),
      joinRequests: debate.joinRequests,
      joinRequestKeys: Object.keys(debate.joinRequests || {})
    });
    
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
      // Check for anonymous users
      const storedRequestId = localStorage.getItem(`debate_${debateId}_requestId`);
      if (storedRequestId) {
        // First check if anonymous user is already a participant
        const isAnonymousParticipant = Object.values(debate.participants).some(p => p.uid === storedRequestId);
        
        if (isAnonymousParticipant) {
          console.log("✅ Anonymous user is already a participant");
          setPermissionStatus("approved");
          return;
        }
        
        // Then check join requests
        if (debate.joinRequests?.[storedRequestId]) {
          const existingRequest = debate.joinRequests[storedRequestId];
          console.log("📝 Anonymous request found:", existingRequest);
          setPermissionStatus(existingRequest.status === "pending" ? "request_sent" : existingRequest.status);
          return;
        }
      }
    }

    // For anonymous users or signed-in users without access
    // New user (anonymous or signed-in) needs to request permission
    console.log("🔔 New user, showing join modal");
    setShowJoinRequestModal(true);
    setPermissionStatus(null);
  }, [user, debate]);

  // Load analysis from database or trigger calculation when debate is completed
  useEffect(() => {
    if (debate?.status === "completed") {
      if (debate.analysis) {
        // Use persisted analysis from database
        console.log("📊 Loading persisted analysis from database");
        setDebateAnalysis({
          winner: debate.analysis.winner,
          aScore: debate.analysis.aScore,
          bScore: debate.analysis.bScore,
          summary: debate.analysis.summary
        });
        setShowResultsModal(true);
      } else if (!debateAnalysis && !analyzingResults) {
        // Calculate analysis for the first time
        console.log("🤖 No analysis found, calculating for first time");
        analyzeDebateResults();
      }
    }
  }, [debate?.status, debate?.analysis, debateAnalysis, analyzingResults]);

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

  // Round timer countdown
  useEffect(() => {
    if (!debate || debate.status !== "active" || !debate.currentRoundTimeLeft || debate.currentRoundTimeLeft <= 0) {
      setRoundTimeLeft(0);
      return;
    }

    // Calculate time left based on when round started
    if (debate.roundStartedAt) {
      const startTime = (debate.roundStartedAt as { toDate?: () => Date }).toDate ? (debate.roundStartedAt as { toDate: () => Date }).toDate().getTime() : Date.now();
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const timeRemaining = Math.max(0, debate.currentRoundTimeLeft - elapsedSeconds);
      
      setRoundTimeLeft(timeRemaining);

      // Auto-skip if time expires
      if (timeRemaining <= 0 && debate.currentTurn) {
        autoSkipTurn();
        return;
      }
    }

    const timer = setInterval(() => {
      setRoundTimeLeft((prev) => {
        const newTime = Math.max(0, prev - 1);
        if (newTime <= 0 && debate.currentTurn) {
          // Auto-skip when timer reaches 0
          autoSkipTurn();
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [debate?.currentRoundTimeLeft, debate?.roundStartedAt, debate?.currentTurn, debate?.status]);

  const analyzeDebateResults = async () => {
    if (!debate || !debateArguments.length) return;
    
    setAnalyzingResults(true);
    console.log("🏆 Analyzing final debate results...");
    
    try {
      // Separate arguments by position
      const aArguments = debateArguments
        .filter(arg => arg.position === "a")
        .map(arg => ({ text: arg.text, score: arg.aiScore || 0 }));
      
      const bArguments = debateArguments
        .filter(arg => arg.position === "b")
        .map(arg => ({ text: arg.text, score: arg.aiScore || 0 }));
      
      console.log("🏆 Arguments summary:", { aCount: aArguments.length, bCount: bArguments.length });
      
      // Call the AI analysis API
      const response = await fetch("/api/analyze-debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: debate.topic,
          positionA: debate.positionA,
          positionB: debate.positionB,
          aArguments,
          bArguments,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("🏆 Debate analysis complete:", result);
        console.log("🏆 Analysis data:", result.analysis);
        console.log("🏆 Winner value:", result.analysis?.winner);
        
        // Save analysis to Firestore for persistence
        const analysisData = {
          winner: result.analysis.winner,
          aScore: result.analysis.aScore,
          bScore: result.analysis.bScore,
          summary: result.analysis.summary,
          analyzedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, "debates", debateId), {
          analysis: analysisData
        });
        
        console.log("💾 Analysis saved to database");
        setDebateAnalysis(result.analysis);
        setShowResultsModal(true);
      } else {
        const error = await response.json();
        console.error("❌ Debate analysis failed:", error);
        // Show results modal even if analysis fails, with basic scoring
        const aAvg = aArguments.reduce((sum, arg) => sum + arg.score, 0) / aArguments.length || 0;
        const bAvg = bArguments.reduce((sum, arg) => sum + arg.score, 0) / bArguments.length || 0;
        
        const winner: "a" | "b" | "tie" = aAvg > bAvg ? "a" : bAvg > aAvg ? "b" : "tie";
        const fallbackAnalysis = {
          winner,
          aScore: aAvg,
          bScore: bAvg,
          summary: `Analysis failed. Basic scoring: Position A averaged ${aAvg.toFixed(1)}, Position B averaged ${bAvg.toFixed(1)}.`
        };
        
        // Save fallback analysis to database
        const analysisData = {
          ...fallbackAnalysis,
          analyzedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, "debates", debateId), {
          analysis: analysisData
        });
        
        console.log("💾 Fallback analysis saved to database");
        setDebateAnalysis(fallbackAnalysis);
        setShowResultsModal(true);
      }
    } catch (error) {
      console.error("Error analyzing debate:", error);
      setShowResultsModal(true); // Show modal even on error
    } finally {
      setAnalyzingResults(false);
    }
  };

  const autoSkipTurn = async () => {
    if (!debate || !debate.currentTurn) return;
    
    console.log("⏰ Auto-skipping turn due to timeout");
    
    try {
      // Submit a skipped argument with 0 points
      const currentUserPosition = debate.currentTurn === debate.participants.a?.uid ? "a" : "b";
      const currentParticipant = debate.participants[currentUserPosition];
      
      if (currentParticipant) {
        await addDoc(
          collection(db, "debates", debateId, "arguments"),
          {
            text: "[SKIPPED - Time expired]",
            authorId: currentParticipant.uid,
            authorName: currentParticipant.name,
            authorAlias: currentParticipant.alias,
            position: currentUserPosition,
            timestamp: serverTimestamp(),
            round: debate.round,
            aiScore: 0, // 0 points for skipped turn
            aiAnalysis: {
              reasoning: "Turn was automatically skipped due to time expiration.",
              strengths: [],
              weaknesses: ["Failed to respond within time limit"],
              logicalFallacies: [],
            },
          }
        );
      }

      // Move to next turn
      const nextTurn = getNextTurn();
      const nextRound = shouldAdvanceRound() ? debate.round + 1 : debate.round;
      const isDebateComplete = nextRound > debate.maxRounds;

      await updateDoc(doc(db, "debates", debateId), {
        currentTurn: isDebateComplete ? null : nextTurn,
        round: nextRound,
        status: isDebateComplete ? "completed" : "active",
        currentRoundTimeLeft: isDebateComplete ? null : debate.roundTimeLimit,
        roundStartedAt: isDebateComplete ? null : serverTimestamp(),
      });

      console.log("✅ Turn auto-skipped, moved to next player");
    } catch (error) {
      console.error("Error auto-skipping turn:", error);
    }
  };

  const joinDebateSimple = async () => {
    if (!userAlias.trim() || !debate) return;

    console.log("🚀 joinDebateSimple started");
    console.log("🚀 Current debate participants before join:", debate.participants);
    console.log("🚀 Current permission status:", permissionStatus);

    // Temporarily removed all permission checks for testing

    try {
      // Get user ID (for signed-in users) or from localStorage (for anonymous users)
      const userId = user?.uid || localStorage.getItem(`debate_${debateId}_requestId`);
      if (!userId) return;

      // Determine available position
      const availablePosition = !debate.participants.a ? "a" : "b";
      console.log("🚀 Available position:", availablePosition, {
        "participants.a exists": !!debate.participants.a,
        "participants.b exists": !!debate.participants.b
      });

      // Get the position statement for this user
      const positionStatement =
        availablePosition === "a" ? positionAStatement : positionBStatement;
      if (!positionStatement.trim()) return;

      const updatedParticipants = {
        ...debate.participants,
        [availablePosition]: {
          uid: userId,
          name: user?.displayName || userAlias.trim(),
          alias: userAlias.trim(),
          photoURL: user?.photoURL || "",
          position: availablePosition,
          isAnonymous: !user,
        },
      };

      const bothPlayersJoined = Object.keys(updatedParticipants).length === 2;

      // Create the updated participants object with proper nesting
      const updatedParticipantsObject = {
        ...debate.participants,
        [availablePosition]: {
          uid: userId,
          name: user?.displayName || userAlias.trim(),
          alias: userAlias.trim(),
          photoURL: user?.photoURL || "",
          position: availablePosition,
          isAnonymous: !user,
        }
      };

      const updateData: UpdateData<any> = {
        participants: updatedParticipantsObject,
        [`position${availablePosition.toUpperCase()}`]:
          positionStatement.trim(),
        isPublic: isPublic,
        status: bothPlayersJoined ? "ready_to_start" : "waiting_for_players",
      };

      // Remove the join request since user is now joining
      if (debate.joinRequests?.[userId]) {
        updateData[`joinRequests.${userId}`] = deleteField();
      }

      console.log("🚀 About to save updateData:", updateData);
      console.log("🚀 Participants object being saved:", updateData.participants);
      
      await updateDoc(doc(db, "debates", debateId), updateData);

      console.log(`✅ Joined as Position ${availablePosition.toUpperCase()}`);
    } catch (error) {
      console.error("Error joining debate:", error);
    }
  };

  const startDebate = async () => {
    if (!debate || Object.keys(debate.participants).length < 2) return;

    try {
      // Creator starts first
      const creatorParticipant = Object.values(debate.participants).find(p => p.uid === debate.creatorId);
      if (!creatorParticipant) return;

      await updateDoc(doc(db, "debates", debateId), {
        status: "active",
        currentTurn: creatorParticipant.uid,
        round: 1,
        currentRoundTimeLeft: debate.roundTimeLimit || 120,
        roundStartedAt: serverTimestamp(),
      });
      console.log("✅ Debate started! Creator goes first.");
    } catch (error) {
      console.error("Error starting debate:", error);
    }
  };

  const submitArgument = async () => {
    if (!debate || !currentArgument.trim() || submitting || !isValidWordCount(currentArgument)) return;
    
    // Handle both signed-in and anonymous users
    const currentUserId = user?.uid || localStorage.getItem(`debate_${debateId}_requestId`);
    if (!currentUserId) return;

    const userPosition = getUserPosition();
    if (!userPosition) return;

    setSubmitting(true);

    try {
      const userParticipant = debate.participants[userPosition];
      const argumentRef = await addDoc(
        collection(db, "debates", debateId, "arguments"),
        {
          text: currentArgument.trim(),
          authorId: currentUserId,
          authorName: userParticipant?.name || user?.displayName || "Anonymous",
          authorAlias: userParticipant?.alias || user?.displayName || "Anonymous",
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
      console.log("🤖 Calling AI scoring API...");
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

      console.log("🤖 API Response status:", response.status);
      const result = await response.json();
      console.log("🤖 API Response data:", result);

      if (!response.ok) {
        // Handle API error - display error details on the argument
        console.error("❌ AI Scoring API failed:", result);
        
        await updateDoc(
          doc(db, "debates", debateId, "arguments", argumentRef.id),
          {
            aiScore: 0,
            aiAnalysis: {
              reasoning: `AI Scoring Error: ${result.details?.message || result.error || "Unknown error"}`,
              strengths: ["Argument submitted (AI scoring failed)"],
              weaknesses: [`Error details: ${JSON.stringify(result.details, null, 2)}`],
              logicalFallacies: [],
            },
          }
        );
      } else {
        // Success - update with AI analysis
        const aiScore = result.score;
        console.log("✅ AI Scoring successful:", aiScore);

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
      }

      // Update debate turn
      // Count current arguments in this round (before this new one is added to debateArguments state)
      const currentRoundArgs = debateArguments.filter(arg => arg.round === debate.round);
      const totalArgsAfterThis = currentRoundArgs.length + 1; // Include the argument we just submitted
      
      console.log("🔄 Turn logic before update:", {
        currentRound: debate.round,
        currentRoundArgsBeforeThis: currentRoundArgs.length,
        totalArgsAfterThis,
        maxRounds: debate.maxRounds
      });

      let nextRound = debate.round;
      let nextTurn = getNextTurn();
      
      // If this completes the round (both players have argued), advance to next round
      if (totalArgsAfterThis >= 2) {
        nextRound = debate.round + 1;
        // Next turn should be the creator (position A) for new rounds
        nextTurn = debate.participants.a?.uid || "";
        console.log("🔄 Advancing to next round:", nextRound);
      }
      
      const isDebateComplete = nextRound > debate.maxRounds;
      
      console.log("🔄 Final turn logic:", {
        nextRound,
        nextTurn,
        isDebateComplete
      });

      await updateDoc(doc(db, "debates", debateId), {
        currentTurn: isDebateComplete ? null : nextTurn,
        round: nextRound,
        status: isDebateComplete ? "completed" : "active",
        currentRoundTimeLeft: isDebateComplete ? null : debate.roundTimeLimit,
        roundStartedAt: isDebateComplete ? null : serverTimestamp(),
      });

      setCurrentArgument("");
      console.log("✅ Argument submitted");
    } catch (error) {
      console.error("Error submitting argument:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to submit argument: ${errorMessage}\n\nCheck console for details.`);
    } finally {
      setSubmitting(false);
    }
  };

  const getUserPosition = (): "a" | "b" | null => {
    if (!debate) return null;

    // Get current user ID (signed-in or anonymous)
    const currentUserId = user?.uid || localStorage.getItem(`debate_${debateId}_requestId`);
    if (!currentUserId) return null;

    if (debate.participants.a?.uid === currentUserId) return "a";
    if (debate.participants.b?.uid === currentUserId) return "b";
    return null;
  };

  const getNextTurn = (): string => {
    if (!debate) return "";

    const currentUserPosition = getUserPosition();
    if (currentUserPosition === "a") {
      return debate.participants.b?.uid || "";
    } else if (currentUserPosition === "b") {
      return debate.participants.a?.uid || "";
    }
    return "";
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
      const requestId = user?.uid || `anonymous_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
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
      const updateData: UpdateData<any> = {};
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
    if (!debate?.currentTurn) return false;
    
    // Handle both signed-in and anonymous users
    const currentUserId = user?.uid || localStorage.getItem(`debate_${debateId}_requestId`);
    return currentUserId === debate.currentTurn;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getWordCount = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const isValidWordCount = (text: string): boolean => {
    return getWordCount(text) <= 500;
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
  const isCreator = user?.uid === debate?.creatorId;
  const bothPlayersJoined =
    debate && Object.keys(debate.participants).length === 2;

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
            Your request to join &ldquo;{debate.topic}&rdquo; has been sent to the creator. 
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
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary">
            The creator has denied your request to join this debate.
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
      {/* Header with Back Button and Dev Reset */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ color: "primary.main" }}
        >
          Back
        </Button>
        
        {/* Development only - Reset button */}
        {process.env.NODE_ENV === 'development' && (
          <Button
            variant="outlined"
            color="warning"
            size="small"
            onClick={resetPermissionState}
          >
            🔄 Reset Permission State
          </Button>
        )}
      </Box>

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
              {(!userPosition && permissionStatus === "approved") ? (
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
              ) : userPosition && !bothPlayersJoined ? (
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

      {/* Debate Interface - Active and Completed */}
      {(debate.status === "active" || debate.status === "completed") && (
        <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          {/* Header with Title and Timers */}
          <Card sx={{ mb: 2, p: 3, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: "bold", flex: 1 }}>
                {debate.topic}
              </Typography>
              
              {debate.status === "completed" && debateAnalysis ? (
                /* Winner Info when completed */
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
                      {debateAnalysis.winner === "tie" 
                        ? "🤝 It's a Tie!" 
                        : `Debate is won by ${
                            debateAnalysis.winner === "a" 
                              ? debate.participants.a?.alias || "Position A"
                              : debate.participants.b?.alias || "Position B"
                          } with position ${debateAnalysis.winner.toUpperCase()}`
                      }
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Position A: {debateAnalysis.aScore?.toFixed(1) || "0.0"}/10 | Position B: {debateAnalysis.bScore?.toFixed(1) || "0.0"}/10
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ 
                      color: "white", 
                      borderColor: "rgba(255,255,255,0.5)",
                      "&:hover": { borderColor: "white" }
                    }}
                    onClick={() => setShowResultsModal(true)}
                  >
                    View Details
                  </Button>
                </Box>
              ) : (
                /* Timers when active */
                <>
                  {/* Total Debate Timer */}
                  <Box sx={{ textAlign: "center", mx: 3 }}>
                    <Typography variant="h4" sx={{ fontFamily: "monospace", fontWeight: "bold" }}>
                      {formatTime(timeLeft)}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Total Time
                    </Typography>
                  </Box>
                  
                  {/* Round Timer */}
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h4" sx={{ fontFamily: "monospace", fontWeight: "bold", color: roundTimeLeft <= 30 ? "#ff5722" : "#ffeb3b" }}>
                      {formatTime(roundTimeLeft)}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Round Time
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
            
            {/* Round and Turn Indicator - Only show when debate is active */}
            {debate.status === "active" && (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <Typography variant="h6" sx={{ mr: 2 }}>
                  Round {debate.round} of {debate.maxRounds}
                </Typography>
                <Box sx={{ 
                  px: 2, 
                  py: 1, 
                  backgroundColor: "rgba(255,255,255,0.2)", 
                  borderRadius: "20px",
                  backdropFilter: "blur(10px)"
                }}>
                  <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                    {isMyTurn() ? "🟢 Your Turn" : "🔴 Opponent's Turn"}
                  </Typography>
                </Box>
              </Box>
            )}
          </Card>

          {/* Two-Column Debate Layout */}
          <Grid container spacing={3} sx={{ flex: 1, height: "calc(100vh - 220px)" }}>
            {/* My Column (Left) */}
            <Grid size={6}>
              <Card sx={{ 
                height: "100%", 
                display: "flex", 
                flexDirection: "column",
                background: userPosition === "a" ? "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" : "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                color: "white"
              }}>
                {/* My Column Header */}
                <Box sx={{ p: 2, borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography variant="h5" sx={{ mr: 2 }}>
                        {userPosition === "a" ? "🅰️" : "🅱️"}
                      </Typography>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                          {userPosition === "a" ? debate.participants.a?.alias : debate.participants.b?.alias} (You)
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          {`"${userPosition === "a" ? debate.positionA : debate.positionB}"`}
                        </Typography>
                      </Box>
                    </Box>
                    
                    {/* Round Timer for Current User */}
                    {isMyTurn() && (
                      <Box sx={{ 
                        px: 2, 
                        py: 1, 
                        backgroundColor: "rgba(255,235,59,0.2)", 
                        borderRadius: "10px",
                        border: "2px solid #ffeb3b"
                      }}>
                        <Typography variant="h6" sx={{ fontFamily: "monospace", color: "#ffeb3b" }}>
                          {formatTime(roundTimeLeft)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* My Previous Arguments */}
                <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
                  {debateArguments
                    .filter(arg => arg.position === userPosition)
                    .map((arg) => (
                      <Card key={arg.id} sx={{ mb: 2, backgroundColor: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)" }}>
                        <CardContent>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: "bold", color: "white" }}>
                              Round {arg.round}
                            </Typography>
                            {arg.aiScore && (
                              <Typography variant="caption" sx={{ color: "#ffeb3b" }}>
                                🤖 {arg.aiScore.toFixed(1)}/10
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ color: "white" }}>
                            {arg.text}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                </Box>

                {/* My Input Area - Only show when debate is active */}
                {userPosition && debate.status === "active" && (
                  <Box sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        {isMyTurn() ? "🟢 Your Turn - Type your argument" : "⏸️ Wait for your turn"}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {getWordCount(currentArgument)}/500 words
                      </Typography>
                    </Box>
                    
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      value={currentArgument}
                      onChange={(e) => setCurrentArgument(e.target.value)}
                      placeholder={isMyTurn() ? "Make your argument..." : "Wait for your turn..."}
                      disabled={!isMyTurn()}
                      slotProps={{ htmlInput: { maxLength: 500 } }}
                      sx={{ 
                        mb: 2,
                        "& .MuiOutlinedInput-root": {
                          backgroundColor: "rgba(255,255,255,0.1)",
                          color: "white",
                          "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                          "&:hover fieldset": { borderColor: "rgba(255,255,255,0.5)" },
                          "&.Mui-focused fieldset": { borderColor: "white" }
                        },
                        "& .MuiInputBase-input::placeholder": { color: "rgba(255,255,255,0.7)" }
                      }}
                    />
                    
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={submitArgument}
                      disabled={!isMyTurn() || !currentArgument.trim() || submitting || !isValidWordCount(currentArgument)}
                      sx={{
                        backgroundColor: "rgba(255,255,255,0.2)",
                        color: "white",
                        fontWeight: "bold",
                        "&:hover": { backgroundColor: "rgba(255,255,255,0.3)" },
                        "&:disabled": { backgroundColor: "rgba(255,255,255,0.1)" }
                      }}
                    >
                      {submitting ? "Submitting..." : "Submit Argument"}
                    </Button>
                  </Box>
                )}
              </Card>
            </Grid>

            {/* Opponent Column (Right) */}
            <Grid size={6}>
              <Card sx={{ 
                height: "100%", 
                display: "flex", 
                flexDirection: "column",
                background: userPosition === "b" ? "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" : "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                color: "white"
              }}>
                {/* Opponent Column Header */}
                <Box sx={{ p: 2, borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography variant="h5" sx={{ mr: 2 }}>
                        {userPosition === "a" ? "🅱️" : "🅰️"}
                      </Typography>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                          {userPosition === "a" ? debate.participants.b?.alias : debate.participants.a?.alias} (Opponent)
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          {`"${userPosition === "a" ? debate.positionB : debate.positionA}"`}
                        </Typography>
                      </Box>
                    </Box>
                    
                    {/* Round Timer for Opponent */}
                    {!isMyTurn() && (
                      <Box sx={{ 
                        px: 2, 
                        py: 1, 
                        backgroundColor: "rgba(255,235,59,0.2)", 
                        borderRadius: "10px",
                        border: "2px solid #ffeb3b"
                      }}>
                        <Typography variant="h6" sx={{ fontFamily: "monospace", color: "#ffeb3b" }}>
                          {formatTime(roundTimeLeft)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Opponent Previous Arguments */}
                <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
                  {debateArguments
                    .filter(arg => arg.position !== userPosition)
                    .map((arg) => (
                      <Card key={arg.id} sx={{ mb: 2, backgroundColor: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)" }}>
                        <CardContent>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: "bold", color: "white" }}>
                              Round {arg.round}
                            </Typography>
                            {arg.aiScore && (
                              <Typography variant="caption" sx={{ color: "#ffeb3b" }}>
                                🤖 {arg.aiScore.toFixed(1)}/10
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ color: "white" }}>
                            {arg.text}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                </Box>

                {/* Opponent Status - Only show when debate is active */}
                {debate.status === "active" && (
                  <Box sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,0.2)", textAlign: "center" }}>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      {!isMyTurn() ? "🟡 Opponent is thinking..." : "⏸️ Waiting for their turn"}
                    </Typography>
                  </Box>
                )}
              </Card>
            </Grid>
          </Grid>

        </Box>
      )}

      {/* Join Request Modal */}
      <Dialog open={showJoinRequestModal} onClose={() => setShowJoinRequestModal(false)}>
        <DialogTitle>Join Debate</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            You&apos;re about to request permission to join &ldquo;{debate?.topic}&rdquo;. Please enter your name:
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

      {/* Debate Results Modal */}
      <Dialog 
        open={showResultsModal} 
        onClose={() => setShowResultsModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: "center", pb: 1, fontWeight: "bold", color: "primary.main" }}>
          🏆 Debate Complete!
        </DialogTitle>
        
        <DialogContent sx={{ pt: 2 }}>
          {analyzingResults ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                🤖 Analyzing debate results...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Our AI is evaluating all arguments and determining the winner
              </Typography>
            </Box>
          ) : debateAnalysis ? (
            <Box>
              {/* Winner Declaration */}
              <Card sx={{ 
                p: 3, 
                mb: 3, 
                textAlign: "center", 
                background: debateAnalysis.winner === "tie" 
                  ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                  : debateAnalysis.winner === "a" 
                    ? "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" 
                    : debateAnalysis.winner === "b"
                      ? "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
                      : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                color: "white"
              }}>
                <Typography variant="h5" sx={{ fontWeight: "bold", mb: 2 }}>
                  {debateAnalysis.winner === "tie" 
                    ? "🤝 It's a Tie!" 
                    : debateAnalysis.winner 
                      ? `🎉 Winner: Position ${debateAnalysis.winner.toUpperCase()}`
                      : "🏁 Debate Complete"
                  }
                </Typography>
                
                <Box sx={{ display: "flex", justifyContent: "space-around", mb: 2 }}>
                  <Box>
                    <Typography variant="h6">{debate?.participants?.a?.alias || "Position A"}</Typography>
                    <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                      {debateAnalysis.aScore?.toFixed(1) || "0.0"}/10
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="h6">{debate?.participants?.b?.alias || "Position B"}</Typography>
                    <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                      {debateAnalysis.bScore?.toFixed(1) || "0.0"}/10
                    </Typography>
                  </Box>
                </Box>
              </Card>

              {/* AI Analysis Summary */}
              <Card sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
                  🤖 AI Analysis
                </Typography>
                <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                  {debateAnalysis.summary || "Analysis completed successfully."}
                </Typography>
              </Card>

              {/* Action Buttons */}
              <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                {/* Extend Discussion Button */}
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  sx={{ minWidth: 200 }}
                  onClick={() => {
                    // TODO: Implement extension payment logic
                    alert("Extension feature coming soon! This will require a $1.99 payment or subscription.");
                  }}
                >
                  🚀 Extend Discussion
                  <Typography variant="caption" sx={{ display: "block", fontSize: "0.7rem" }}>
                    $1.99 or Premium
                  </Typography>
                </Button>

                {/* Appeal Result Button */}
                <Button
                  variant="outlined"
                  color="warning"
                  size="large"
                  sx={{ minWidth: 200 }}
                  onClick={() => {
                    // TODO: Implement appeal functionality
                    alert("Appeal functionality will be added soon!");
                  }}
                >
                  ⚖️ Appeal Result
                  <Typography variant="caption" sx={{ display: "block", fontSize: "0.7rem" }}>
                    Challenge AI decision
                  </Typography>
                </Button>

                {/* Share Results Button */}
                <Button
                  variant="outlined"
                  color="secondary"
                  size="large"
                  sx={{ minWidth: 200 }}
                  onClick={() => {
                    // TODO: Implement sharing functionality
                    const shareText = `I just completed a debate on "${debate?.topic}" and ${
                      debateAnalysis.winner === "tie" ? "it was a tie" : 
                      debateAnalysis.winner === getUserPosition() ? "I won" : "my opponent won"
                    }! Check out DebateAI.`;
                    if (navigator.share) {
                      navigator.share({ text: shareText });
                    } else {
                      alert("Share: " + shareText);
                    }
                  }}
                >
                  📤 Share Results
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography variant="h6" color="error">
                Unable to analyze debate results
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The debate has ended but analysis failed
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button 
            onClick={() => setShowResultsModal(false)} 
            variant="contained"
            color="primary"
            size="large"
          >
            Close Results
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
