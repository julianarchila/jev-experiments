# Jev experiments

This repository is for building and running small experiments with Jev.

Read the [TypeSafe introduction](https://docs.typesafe.ai/introduction) and [API documentation](https://docs.typesafe.ai/api) before working on an experiment. The [JavaScript SDK documentation](https://docs.typesafe.ai/sdk/javascript) includes a typed usage example.

The TypeSafe API key lives in `.env.local` as `TYPESAFE_API_KEY`. Git ignores this file. Never print or commit the key.

Install the JavaScript SDK with `npm install @typesafe-ai/sdk`. Use `TypeSafeClient.systemOne()` to send a `state` and typed questions to Jev.
