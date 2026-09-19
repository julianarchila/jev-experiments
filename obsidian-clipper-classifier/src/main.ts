import {
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  TFile,
} from "obsidian";
import {
  buildRequest,
  classificationFromResponse,
  mergeTags,
  type Classification,
  type NoteState,
} from "./classifier";
import { DEFAULT_SETTINGS, parseList, type JevClipperSettings } from "./settings";
import { evaluateWithJev } from "./typesafe";

const CLASSIFIED_PROPERTY = "jev_classified";
const MODEL_PROPERTY = "jev_model";
const CONFIDENCE_PROPERTY = "jev_category_confidence";

export default class JevClipperClassifierPlugin extends Plugin {
  settings: JevClipperSettings = DEFAULT_SETTINGS;
  private readonly inFlight = new Set<string>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new JevClipperSettingTab(this));

    this.addCommand({
      id: "classify-active-note",
      name: "Classify active note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.classifyFile(file, true);
        return true;
      },
    });

    this.addCommand({
      id: "classify-unprocessed-clippings",
      name: "Classify unprocessed clippings",
      callback: () => void this.classifyUnprocessedClippings(),
    });

    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on("create", (file) => this.handleCreatedFile(file)));
    });
  }

  private handleCreatedFile(file: TAbstractFile): void {
    if (!this.settings.autoClassify || !(file instanceof TFile) || file.extension !== "md") return;
    if (!this.isInWatchedFolder(file)) return;

    window.setTimeout(() => void this.classifyFile(file, false), 1200);
  }

  private isInWatchedFolder(file: TFile): boolean {
    const folder = this.settings.watchedFolder.trim().replace(/^\/+|\/+$/g, "");
    return !folder || file.path === `${folder}.md` || file.path.startsWith(`${folder}/`);
  }

  async classifyFile(file: TFile, force: boolean): Promise<void> {
    if (this.inFlight.has(file.path)) return;
    this.inFlight.add(file.path);

    try {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!force && cache?.frontmatter?.[CLASSIFIED_PROPERTY] === true) return;

      const categories = parseList(this.settings.categories);
      const tags = parseList(this.settings.tags);
      const rawContent = await this.app.vault.cachedRead(file);
      const state: NoteState = {
        title: file.basename,
        path: file.path,
        properties: cache?.frontmatter ?? {},
        content: rawContent.slice(0, this.settings.maxContentCharacters),
      };
      const options = {
        categories,
        tags,
        categoryConfidence: this.settings.categoryConfidence,
        tagProbability: this.settings.tagProbability,
      };
      const request = buildRequest(state, options);
      const response = await evaluateWithJev(this.settings.apiKey, request);
      const classification = classificationFromResponse(response, options);

      await this.writeClassification(file, classification);
      const categoryMessage = classification.category ?? "category needs review";
      new Notice(`Jev classified ${file.basename}: ${categoryMessage}, ${classification.tags.length} tags.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Jev Clipper Classifier failed", error);
      new Notice(`Jev classification failed: ${message}`);
    } finally {
      this.inFlight.delete(file.path);
    }
  }

  private async writeClassification(file: TFile, result: Classification): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      if (result.category) frontmatter[this.settings.categoryProperty] = result.category;
      frontmatter[this.settings.tagProperty] = mergeTags(
        frontmatter[this.settings.tagProperty],
        result.tags,
      );
      frontmatter[CLASSIFIED_PROPERTY] = true;
      frontmatter[MODEL_PROPERTY] = result.model;
      frontmatter[CONFIDENCE_PROPERTY] = Number(result.categoryConfidence.toFixed(3));
    });
  }

  private async classifyUnprocessedClippings(): Promise<void> {
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => this.isInWatchedFolder(file))
      .filter((file) => this.app.metadataCache.getFileCache(file)?.frontmatter?.[CLASSIFIED_PROPERTY] !== true);

    if (files.length === 0) {
      new Notice("No unprocessed clippings found.");
      return;
    }

    new Notice(`Classifying ${files.length} clippings.`);
    for (const file of files) await this.classifyFile(file, false);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

class JevClipperSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: JevClipperClassifierPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Jev Clipper Classifier" });
    containerEl.createEl("p", {
      text: "Classify notes created in a chosen folder. The note content is sent to TypeSafe AI.",
      cls: "jev-clipper-classifier-setting-description",
    });

    new Setting(containerEl)
      .setName("TypeSafe API key")
      .setDesc("Stored in this vault's local plugin data.")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("ts_...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Classify new notes automatically")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoClassify).onChange(async (value) => {
          this.plugin.settings.autoClassify = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Clippings folder")
      .setDesc("Only new Markdown files inside this folder are classified automatically.")
      .addText((text) =>
        text.setValue(this.plugin.settings.watchedFolder).onChange(async (value) => {
          this.plugin.settings.watchedFolder = value;
          await this.plugin.saveSettings();
        }),
      );

    this.addTextareaSetting("Categories", "One fixed category per line.", "categories");
    this.addTextareaSetting("Tags", "One allowed tag per line.", "tags");

    new Setting(containerEl)
      .setName("Category confidence")
      .setDesc("Write the category only when confidence meets this threshold.")
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.05)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.categoryConfidence)
          .onChange(async (value) => {
            this.plugin.settings.categoryConfidence = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Tag probability")
      .setDesc("Add each tag whose Noul probability meets this threshold.")
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.05)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.tagProbability)
          .onChange(async (value) => {
            this.plugin.settings.tagProbability = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private addTextareaSetting(
    name: string,
    description: string,
    key: "categories" | "tags",
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addTextArea((textarea) => {
        textarea.inputEl.rows = 8;
        textarea.inputEl.cols = 28;
        textarea.setValue(this.plugin.settings[key]).onChange(async (value) => {
          this.plugin.settings[key] = value;
          await this.plugin.saveSettings();
        });
      });
  }
}
