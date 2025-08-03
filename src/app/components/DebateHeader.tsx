"use client";

import { Card, Box, Typography, Button } from "@mui/material";

interface DebateAnalysis {
  winner: "a" | "b" | "tie";
  aScore: number;
  bScore: number;
  summary: string;
}

interface DebateHeaderProps {
  status: "active" | "completed";
  analysis?: DebateAnalysis;
  participants: {
    a?: { alias: string };
    b?: { alias: string };
  };
  roundTimeLeft: number;
  onViewDetails: () => void;
}

export default function DebateHeader({
  status,
  analysis,
  participants,
  roundTimeLeft,
  onViewDetails,
}: DebateHeaderProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card
      sx={{
        mb: 3,
        background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
        color: "white",
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 2,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
          {status === "active" ? "new debate starts" : "debate completed"}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {status === "completed" && analysis ? (
            <>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                  🏆 Debate is won by{" "}
                  {analysis.winner === "a"
                    ? participants.a?.alias || "Position A"
                    : analysis.winner === "b"
                    ? participants.b?.alias || "Position B"
                    : "Tie"}{" "}
                  with position {analysis.winner?.toUpperCase() || "TIE"}
                </Typography>
                <Typography variant="caption">
                  Position A: {analysis.aScore?.toFixed(1) || "0.0"}/10
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                sx={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  color: "white",
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.3)" },
                }}
                onClick={onViewDetails}
              >
                VIEW DETAILS
              </Button>
            </>
          ) : (
            <Box
              sx={{
                px: 2,
                py: 1,
                backgroundColor: "rgba(255,235,59,0.9)",
                color: "#000",
                borderRadius: 2,
                fontWeight: "bold",
                fontFamily: "monospace",
              }}
            >
              {formatTime(roundTimeLeft)}
            </Box>
          )}
        </Box>
      </Box>
    </Card>
  );
}