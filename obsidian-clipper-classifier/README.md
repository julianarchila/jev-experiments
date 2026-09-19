# Jev Clipper Classifier

An Obsidian plugin that categorizes and tags notes created by Web Clipper. It sends the note to [Jev](https://docs.typesafe.ai/introduction), applies confidence thresholds, and writes the accepted results to note properties.

## How it works

The plugin watches a configurable folder. When a Markdown file appears, it sends one request to Jev containing:

- A `Choice` question for the category.
- One `Noul` question for each allowed tag.

The plugin writes the category only when the `Choice` confidence meets the configured threshold. It adds tags whose `Noul` probability meets the tag threshold. Existing tags remain unchanged.

Processed notes receive these properties:

```yaml
category: programming
tags:
  - clippings
  - ai
  - tutorial
jev_classified: true
jev_model: jev-latest
jev_category_confidence: 0.84
```

## Install for local use

```sh
cd obsidian-clipper-classifier
npm install
npm run build
```

Copy or symlink this directory to:

```text
<vault>/.obsidian/plugins/jev-clipper-classifier
```

Enable the plugin under **Settings → Community plugins**. Open its settings and add your TypeSafe API key. The key is stored in the vault's plugin data.

The default watched folder is `Clippings`, which matches the default Web Clipper template. Change it if your template writes elsewhere.

## Commands

- `Jev Clipper Classifier: Classify active note` classifies the open note, even if it was processed before.
- `Jev Clipper Classifier: Classify unprocessed clippings` processes existing notes in the watched folder.

## Development

```sh
npm test
npm run build
npm run test:live
```

`npm run test:live` reads `TYPESAFE_API_KEY` from the repository's ignored `.env.local` file and makes one real request.

## Privacy and limits

The plugin sends the note title, path, properties, and up to 12,000 characters of content to TypeSafe AI. The limit is configurable in code. Automatic classification only watches one folder, but the manual command can classify any active note.

Jev selects from the categories and tags configured in the plugin. It does not invent new labels. A failed request leaves the note unchanged. A low-confidence category is withheld, while qualifying tags can still be added.
