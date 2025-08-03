"use client";

import { Box, Typography } from "@mui/material";
import ArgumentCard from "./ArgumentCard";

interface Argument {
  id: string;
  text: string;
  round: number;
  position: "a" | "b";
  aiScore?: number;
}

interface PositionColumnProps {
  position: "a" | "b";
  participantName: string;
  arguments: Argument[];
}

export default function PositionColumn({
  position,
  participantName,
  arguments: positionArguments,
}: PositionColumnProps) {
  const backgroundColor = position === "a" ? "#d32f2f" : "#1976d2";

  return (
    <Box>
      {/* Position Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            backgroundColor,
            color: "white",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            mr: 2,
          }}
        >
          {position.toUpperCase()}
        </Box>
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
          {participantName}
        </Typography>
      </Box>

      {/* Arguments */}
      {positionArguments
        .filter((arg) => arg.position === position)
        .sort((a, b) => a.round - b.round)
        .map((argument) => (
          <ArgumentCard key={`${position}-${argument.round}`} argument={argument} />
        ))}
    </Box>
  );
}