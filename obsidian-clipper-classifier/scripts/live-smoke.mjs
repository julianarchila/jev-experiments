const apiKey = process.env.TYPESAFE_API_KEY;
if (!apiKey) throw new Error("TYPESAFE_API_KEY is missing.");

const response = await fetch("https://api.typesafe.ai/v1/systemone", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "jev-latest",
    state: {
      title: "Building reliable software with typed AI decisions",
      content: "A TypeScript tutorial about using Jev Choice and Noul questions in an application.",
    },
    questions: {
      category: {
        type: "choice",
        instructions: "Which category best describes this page?",
        criteria: {
          programming: "Software development and code",
          design: "Visual or product design",
          other: "None of the listed categories",
        },
      },
      tag_ai: {
        type: "noul",
        instructions: "Is AI a useful tag for this page?",
        criteria: { true: "AI is a main topic", false: "AI is absent or incidental" },
      },
    },
  }),
});

const body = await response.json();
if (!response.ok) throw new Error(`TypeSafe returned ${response.status}: ${body.message ?? "unknown error"}`);
if (body.answers?.category?.type !== "choice" || body.answers?.tag_ai?.type !== "noul") {
  throw new Error("TypeSafe returned an unexpected response shape.");
}

console.log(JSON.stringify({
  model: body.model,
  category: body.answers.category.choice,
  categoryConfidence: body.answers.category.confidence,
  aiProbability: body.answers.tag_ai.noul,
  inputTokens: body.usage?.input_tokens,
}, null, 2));
