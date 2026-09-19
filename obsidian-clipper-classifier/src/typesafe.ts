import { requestUrl } from "obsidian";
import type { JevRequest, JevResponse } from "./classifier";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export async function evaluateWithJev(apiKey: string, request: JevRequest): Promise<JevResponse> {
  if (!apiKey.trim()) throw new Error("Add a TypeSafe API key in the plugin settings.");

  const response = await requestUrl({
    url: ENDPOINT,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    throw: false,
  });

  if (response.status < 200 || response.status >= 300) {
    const message =
      typeof response.json?.message === "string"
        ? response.json.message
        : `TypeSafe request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return response.json as JevResponse;
}
