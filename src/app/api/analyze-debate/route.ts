import { NextRequest, NextResponse } from "next/server";
import { analyzeDebate } from "../../lib/aiScorer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, positionA, positionB, aArguments = [], bArguments = [] } = body;

    // Validate required fields
    if (!topic || !positionA || !positionB) {
      return NextResponse.json(
        { error: "Missing required fields: topic, positionA, positionB" },
        { status: 400 }
      );
    }

    console.log("🏆 Analyzing debate:", {
      topic,
      aArgumentsCount: aArguments.length,
      bArgumentsCount: bArguments.length
    });

    // Analyze the complete debate using AI
    const analysis = await analyzeDebate(aArguments, bArguments, topic);

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error("Error in analyze-debate API:", error);

    // Return detailed error information for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: "Failed to analyze debate",
        details: {
          message: errorMessage,
          stack: errorStack,
          type: typeof error,
        }
      },
      { status: 500 }
    );
  }
}