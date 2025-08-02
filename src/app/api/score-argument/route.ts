import { NextRequest, NextResponse } from "next/server";
import { scoreArgument } from "../../lib/aiScorer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { argument, position, topic, previousArguments = [] } = body;

    // Validate required fields
    if (!argument || !position || !topic) {
      return NextResponse.json(
        { error: "Missing required fields: argument, position, topic" },
        { status: 400 }
      );
    }

    // Validate position
    if (position !== "a" && position !== "b") {
      return NextResponse.json(
        { error: 'Position must be either "a" or "b"' },
        { status: 400 }
      );
    }

    // Score the argument using AI
    const score = await scoreArgument(
      argument,
      position,
      topic,
      previousArguments
    );

    return NextResponse.json({ success: true, score });
  } catch (error) {
    console.error("Error in score-argument API:", error);

    // Return detailed error information for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: "Failed to score argument",
        details: {
          message: errorMessage,
          stack: errorStack,
          type: typeof error,
          apiKey: process.env.OPENAI_API_KEY ? "API key is set" : "API key is missing",
        }
      },
      { status: 500 }
    );
  }
}
