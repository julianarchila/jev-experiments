export interface JevClipperSettings {
  apiKey: string;
  autoClassify: boolean;
  watchedFolder: string;
  categories: string;
  tags: string;
  categoryProperty: string;
  tagProperty: string;
  categoryConfidence: number;
  tagProbability: number;
  maxContentCharacters: number;
}

export const DEFAULT_SETTINGS: JevClipperSettings = {
  apiKey: "",
  autoClassify: true,
  watchedFolder: "Clippings",
  categories: "technology\nprogramming\ndesign\nproduct\nbusiness\nscience\nculture\npersonal\nother",
  tags: "ai\nprogramming\nweb-development\ndesign\nproduct\nresearch\ntutorial\nreference\nopinion\nnews",
  categoryProperty: "category",
  tagProperty: "tags",
  categoryConfidence: 0.55,
  tagProbability: 0.7,
  maxContentCharacters: 12000,
};

export function parseList(value: string): string[] {
  return [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
}
