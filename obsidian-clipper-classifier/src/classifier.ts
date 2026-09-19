export interface NoteState {
  title: string;
  path: string;
  properties: Record<string, unknown>;
  content: string;
}

export interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
}

export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}

export type JevQuestion = NoulQuestion | ChoiceQuestion;

export interface JevRequest {
  model: "jev-latest";
  state: NoteState;
  questions: Record<string, JevQuestion>;
}

interface ChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

interface NoulAnswer {
  type: "noul";
  noul: number;
}

export interface JevResponse {
  model: string;
  answers: Record<string, ChoiceAnswer | NoulAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

export interface Classification {
  category: string | null;
  categoryConfidence: number;
  tags: string[];
  tagProbabilities: Record<string, number>;
  model: string;
  inputTokens: number;
}

export interface ClassificationOptions {
  categories: string[];
  tags: string[];
  categoryConfidence: number;
  tagProbability: number;
}

function tagQuestionId(index: number): string {
  return `tag_${index}`;
}

export function buildRequest(state: NoteState, options: Pick<ClassificationOptions, "categories" | "tags">): JevRequest {
  if (options.categories.length < 2) {
    throw new Error("Configure at least two categories.");
  }

  const categoryCriteria = Object.fromEntries(
    options.categories.map((category) => [category, `Use when the note primarily belongs to ${category}.`]),
  );

  const questions: Record<string, JevQuestion> = {
    category: {
      type: "choice",
      instructions: "Which category best describes this clipped page? Judge the main subject, not incidental mentions.",
      criteria: categoryCriteria,
    },
  };

  options.tags.forEach((tag, index) => {
    questions[tagQuestionId(index)] = {
      type: "noul",
      instructions: `Is ${JSON.stringify(tag)} a useful tag for finding this note later?`,
      criteria: {
        true: `The note substantially discusses ${tag}.`,
        false: `${tag} is absent, incidental, or too weak to help retrieval.`,
      },
    };
  });

  return { model: "jev-latest", state, questions };
}

export function classificationFromResponse(
  response: JevResponse,
  options: ClassificationOptions,
): Classification {
  const categoryAnswer = response.answers.category;
  if (!categoryAnswer || categoryAnswer.type !== "choice") {
    throw new Error("Jev returned no category answer.");
  }

  const tagProbabilities: Record<string, number> = {};
  const selectedTags: string[] = [];

  options.tags.forEach((tag, index) => {
    const answer = response.answers[tagQuestionId(index)];
    if (!answer || answer.type !== "noul") {
      throw new Error(`Jev returned no answer for tag ${tag}.`);
    }
    tagProbabilities[tag] = answer.noul;
    if (answer.noul >= options.tagProbability) selectedTags.push(tag);
  });

  return {
    category:
      categoryAnswer.confidence >= options.categoryConfidence ? categoryAnswer.choice : null,
    categoryConfidence: categoryAnswer.confidence,
    tags: selectedTags,
    tagProbabilities,
    model: response.model,
    inputTokens: response.usage.input_tokens,
  };
}

export function mergeTags(current: unknown, additions: string[]): string[] {
  const existing = Array.isArray(current)
    ? current.filter((tag): tag is string => typeof tag === "string")
    : typeof current === "string"
      ? current.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];
  return [...new Set([...existing, ...additions])];
}
