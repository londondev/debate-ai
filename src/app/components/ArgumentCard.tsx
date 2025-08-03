"use client";

import { Card, CardContent, Box, Typography } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";

interface Argument {
  id: string;
  text: string;
  round: number;
  position: "a" | "b";
  aiScore?: number;
}

interface ArgumentCardProps {
  argument: Argument;
}

export default function ArgumentCard({ argument }: ArgumentCardProps) {
  return (
    <Card sx={{ mb: 2, p: 2, backgroundColor: "#f5f5f5" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Round {argument.round}
        </Typography>
        {argument.aiScore && (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <StarIcon sx={{ color: "#ffc107", fontSize: 16, mr: 0.5 }} />
            <Typography
              variant="caption"
              sx={{ color: "#ffc107", fontWeight: "bold" }}
            >
              {argument.aiScore.toFixed(1)}/10
            </Typography>
          </Box>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {argument.text.length > 100
          ? argument.text.substring(0, 100) + "..."
          : argument.text}
      </Typography>
    </Card>
  );
}