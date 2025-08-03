"use client";

import { useState } from "react";
import { Card, Typography, Box, TextField, Button } from "@mui/material";

interface ArgumentInputProps {
  isMyTurn: boolean;
  currentRound: number;
  userPosition: "a" | "b";
  positionStatement: string;
  roundTimeLeft: number;
  onSubmit: (argument: string) => void;
  submitting: boolean;
}

export default function ArgumentInput({
  isMyTurn,
  currentRound,
  userPosition,
  positionStatement,
  roundTimeLeft,
  onSubmit,
  submitting,
}: ArgumentInputProps) {
  const [argument, setArgument] = useState("");

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getWordCount = (text: string): number => {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  };

  const isValidWordCount = (text: string): boolean => {
    return getWordCount(text) <= 500;
  };

  const handleSubmit = () => {
    if (argument.trim() && isValidWordCount(argument)) {
      onSubmit(argument.trim());
      setArgument("");
    }
  };

  return (
    <Card sx={{ mt: 3, p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
        {isMyTurn ? `Your Turn - Round ${currentRound}` : "Waiting for opponent..."}
      </Typography>

      {isMyTurn && (
        <>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Typography variant="body2" color="primary">
              Position {userPosition?.toUpperCase()}: "{positionStatement}"
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {getWordCount(argument)}/500 words
            </Typography>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={4}
            value={argument}
            onChange={(e) => setArgument(e.target.value)}
            placeholder="Make your argument..."
            slotProps={{ htmlInput: { maxLength: 500 } }}
            sx={{ mb: 2 }}
          />

          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={
              !argument.trim() || submitting || !isValidWordCount(argument)
            }
            sx={{ mr: 2 }}
          >
            {submitting ? "Submitting..." : "Submit Argument"}
          </Button>

          <Typography variant="caption" color="text.secondary">
            Time remaining: {formatTime(roundTimeLeft)}
          </Typography>
        </>
      )}
    </Card>
  );
}