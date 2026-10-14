import { generateText } from "../services/gemini.service.js";

const DEFAULT_RESULT = {
  political: false,
  hate: false,
  threat: false,
  harassment: false,
  needsReview: false,
  severity: "low",
  reason: "No moderation result was generated.",
};

const normalizeResult = (value) => {
  const result = value && typeof value === "object" ? value : {};

  const severity = ["low", "medium", "high"].includes(result.severity)
    ? result.severity
    : "low";

  return {
    political: Boolean(result.political),
    hate: Boolean(result.hate),
    threat: Boolean(result.threat),
    harassment: Boolean(result.harassment),
    needsReview: Boolean(result.needsReview),
    severity,
    reason:
      typeof result.reason === "string" && result.reason.trim()
        ? result.reason.trim()
        : "No reason supplied.",
  };
};

const extractJson = (text) => {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
};

export const moderateContent = async ({ contentType, content }) => {
  if (!content || !content.trim()) {
    return DEFAULT_RESULT;
  }

  const systemInstruction = `
You are an AI-assisted moderation system for a technical
question-and-answer forum.

Analyze the submitted ${contentType}.

IMPORTANT RULES:

1. Political discussion is allowed.
2. Political discussion alone is NOT a violation.
3. Political opinions alone are NOT hate.
4. Political opinions alone are NOT harassment.
5. Political opinions alone are NOT threats.
6. Identify hateful or dehumanizing content.
7. Identify credible threats or calls for violence.
8. Identify serious targeted harassment.
9. Do not classify ordinary disagreement as harassment.
10. Do not infer protected characteristics without evidence.
11. Return ONLY valid JSON.

Return exactly:

{
  "political": boolean,
  "hate": boolean,
  "threat": boolean,
  "harassment": boolean,
  "needsReview": boolean,
  "severity": "low" | "medium" | "high",
  "reason": "short explanation"
}

Set needsReview=true for credible hate, threat,
or serious targeted harassment.

Set needsReview=false for ordinary political discussion.
`;

  try {
    const responseText = await generateText(content, {
      systemInstruction,
    });

    return normalizeResult(extractJson(responseText));
  } catch (error) {
    console.error("Gemini moderation failed:", error.message);

    return DEFAULT_RESULT;
  }
};
