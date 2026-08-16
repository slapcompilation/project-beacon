<!-- source: https://palantir.com/docs/foundry/ontology-sdk-react-applications/osdk-react-components/ · mirrored 2026-08-16 from Palantir Foundry docs -->

# Build interfaces with OSDK React components

The `@osdk/react-components` library provides pre-built, Ontology-aware React components for common application patterns. You provide generated OSDK types or other OSDK entities, and the components use [`@osdk/react`](/docs/foundry/ontology-sdk-react-applications/osdk-react/) to manage data loading, caching, and state.

Use these components to build common workflows quickly. All components support theming through CSS custom properties and CSS layers, so you can adapt them to your application's design system. You can combine them with your own components and use lower-level `@osdk/react` hooks when you need custom behavior.

## Available building blocks

The library includes components for:

* Rendering objects in a table.
* Building filters backed by object set aggregations.
* Generating forms that validate and apply Ontology actions.
* Viewing documents, PDF files, spreadsheets, email, images, video, and other media.

## Explore the components

Use the [OSDK React components Storybook ↗](https://palantir.github.io/osdk-ts/storybook/) to explore interactive examples, component states, usage patterns, and API documentation. For installation and provider configuration, review the [OSDK React components setup guide ↗](https://palantir.github.io/osdk-ts/storybook/?path=/docs/docs-installation--docs).
