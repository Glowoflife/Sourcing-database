import Instructor from "@instructor-ai/instructor";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
if (!openaiApiKey && !anthropicApiKey) {
  throw new Error("Either OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable must be set");
}

// OpenAI instructor — optional fallback when Anthropic is unavailable.
export const openAIInstructor = openaiApiKey
  ? Instructor({
      client: new OpenAI({ apiKey: openaiApiKey }),
      mode: "TOOLS",
    })
  : null;

// Native Anthropic client — Phase 4 uses direct tool calls plus local Zod validation
// to avoid instructor's retry/validation bug on the full extraction schema.
export const anthropicClient = anthropicApiKey
  ? new Anthropic({ apiKey: anthropicApiKey })
  : null;
