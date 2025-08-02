import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ArgumentScore {
  score: number; // 0-10
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  logicalFallacies: string[];
}

export interface DebateAnalysis {
  winner: "a" | "b" | "tie";
  aScore: number;
  bScore: number;
  summary: string;
}

export async function scoreArgument(
  argument: string,
  position: "a" | "b",
  topic: string,
  previousArguments: Array<{ text: string; position: "a" | "b" }>
): Promise<ArgumentScore> {
  try {
    // Validate API key format
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    if (!apiKey.startsWith('sk-')) {
      throw new Error(`Invalid API key format. Expected key to start with 'sk-' but got: ${apiKey.substring(0, 10)}...`);
    }
    const context =
      previousArguments.length > 0
        ? `Previous arguments in this debate:\n${previousArguments
            .map((arg) => `${arg.position.toUpperCase()}: ${arg.text}`)
            .join("\n\n")}\n\n`
        : "";

    const prompt = `You are an expert debate judge. Score this argument on a scale of 0-10 based on logic, evidence, relevance, and persuasiveness.

Topic: "${topic}"
Position: ${position.toUpperCase()} (${
      position === "a" ? "Position A" : "Position B"
    })

${context}Current argument to score:
"${argument}"

Provide your analysis in this exact JSON format:
{
  "score": [number 0-10],
  "reasoning": "[2-3 sentence explanation of the score]",
  "strengths": ["[strength 1]", "[strength 2]"],
  "weaknesses": ["[weakness 1]", "[weakness 2]"],
  "logicalFallacies": ["[fallacy 1 if any]", "[fallacy 2 if any]"]
}

Scoring criteria:
- 8-10: Excellent logic, strong evidence, highly persuasive
- 6-7: Good reasoning, some evidence, reasonably persuasive  
- 4-5: Basic argument, minimal evidence, somewhat relevant
- 2-3: Weak logic, little evidence, not very persuasive
- 0-1: Poor reasoning, no evidence, irrelevant or fallacious`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse JSON response
    const analysis = JSON.parse(content) as ArgumentScore;

    // Validate score is within range
    analysis.score = Math.max(0, Math.min(10, analysis.score));

    return analysis;
  } catch (error) {
    console.error("Error scoring argument:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
    });

    // Throw the error instead of fallback so we can see what's wrong
    throw error;
  }
}

export async function analyzeDebate(
  aArguments: Array<{ text: string; score?: number }>,
  bArguments: Array<{ text: string; score?: number }>,
  topic: string
): Promise<DebateAnalysis> {
  try {
    const aAverage =
      aArguments.reduce((sum, arg) => sum + (arg.score || 5), 0) /
      aArguments.length;
    const bAverage =
      bArguments.reduce((sum, arg) => sum + (arg.score || 5), 0) /
      bArguments.length;

    const allArguments = [
      ...aArguments.map((arg) => `POSITION A: ${arg.text}`),
      ...bArguments.map((arg) => `POSITION B: ${arg.text}`),
    ].join("\n\n");

    const prompt = `Analyze this complete debate and determine the winner.

Topic: "${topic}"

Arguments:
${allArguments}

AI Scores:
Position A average: ${aAverage.toFixed(1)}/10
Position B average: ${bAverage.toFixed(1)}/10

Provide analysis in this JSON format:
{
  "winner": "[a/b/tie]",
  "aScore": [final score 0-10],
  "bScore": [final score 0-10], 
  "summary": "[2-3 sentence explanation of who won and why]"
}

Consider: logical consistency, evidence quality, addressing opponent's points, overall persuasiveness.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    return JSON.parse(content) as DebateAnalysis;
  } catch (error) {
    console.error("Error analyzing debate:", error);

    // Fallback analysis
    const aAvg =
      aArguments.reduce((sum, arg) => sum + (arg.score || 5), 0) /
      aArguments.length;
    const bAvg =
      bArguments.reduce((sum, arg) => sum + (arg.score || 5), 0) /
      bArguments.length;

    return {
      winner: aAvg > bAvg ? "a" : bAvg > aAvg ? "b" : "tie",
      aScore: aAvg,
      bScore: bAvg,
      summary: `Debate completed. Position A averaged ${aAvg.toFixed(
        1
      )}, Position B averaged ${bAvg.toFixed(1)}.`,
    };
  }
}
