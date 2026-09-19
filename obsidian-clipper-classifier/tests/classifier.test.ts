import { describe, expect, it } from "vitest";
import {
  buildRequest,
  classificationFromResponse,
  mergeTags,
  type JevResponse,
} from "../src/classifier";

const options = {
  categories: ["programming", "design", "other"],
  tags: ["ai", "tutorial"],
  categoryConfidence: 0.6,
  tagProbability: 0.7,
};

describe("buildRequest", () => {
  it("builds one Choice and one Noul per tag", () => {
    const request = buildRequest(
      { title: "Jev", path: "Clippings/Jev.md", properties: {}, content: "Typed AI decisions" },
      options,
    );

    expect(request.model).toBe("jev-latest");
    expect(request.questions.category.type).toBe("choice");
    expect(Object.keys(request.questions)).toEqual(["category", "tag_0", "tag_1"]);
  });

  it("rejects an unusable category list", () => {
    expect(() =>
      buildRequest(
        { title: "Note", path: "Note.md", properties: {}, content: "Text" },
        { categories: ["only"], tags: [] },
      ),
    ).toThrow("at least two categories");
  });
});

describe("classificationFromResponse", () => {
  const response: JevResponse = {
    model: "jev-test",
    answers: {
      category: {
        type: "choice",
        choice: "programming",
        confidence: 0.8,
        probabilities: { programming: 0.9, design: 0.08, other: 0.02 },
      },
      tag_0: { type: "noul", noul: 0.95 },
      tag_1: { type: "noul", noul: 0.4 },
    },
    usage: { input_tokens: 200, output_tokens: 20 },
  };

  it("applies category and tag thresholds", () => {
    expect(classificationFromResponse(response, options)).toMatchObject({
      category: "programming",
      categoryConfidence: 0.8,
      tags: ["ai"],
      inputTokens: 200,
    });
  });

  it("withholds a low-confidence category", () => {
    const cautious = { ...options, categoryConfidence: 0.9 };
    expect(classificationFromResponse(response, cautious).category).toBeNull();
  });
});

describe("mergeTags", () => {
  it("preserves existing tags and removes duplicates", () => {
    expect(mergeTags(["clippings", "ai"], ["ai", "reference"])).toEqual([
      "clippings",
      "ai",
      "reference",
    ]);
  });

  it("supports comma-separated existing tags", () => {
    expect(mergeTags("clippings, research", ["ai"])).toEqual(["clippings", "research", "ai"]);
  });
});
