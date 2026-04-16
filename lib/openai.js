import OpenAI from "openai";

// Uses GitHub Models API with GitHub PAT to access GPT-4o
const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || "https://models.inference.ai.azure.com",
  apiKey: process.env.GITHUB_TOKEN || "dummy_key_for_build",
});

export const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export default client;
