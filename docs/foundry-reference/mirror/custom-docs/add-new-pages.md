<!-- source: https://palantir.com/docs/foundry/custom-docs/add-new-pages/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Add new pages to custom documentation

In-platform custom documentation is written in Markdown. To add a new page to a custom documentation bundle, create a new Markdown file (`.md`) in the documentation repository and ensure that it meets these requirements:

* [Page must use `@title` for the page title](#specify-a-page-title)
* [Page must be listed in `ordering.md`](#add-the-new-page-to-orderingmd)
* [Optional: Specify a label for the table of contents](#optional-use-a-different-label-in-the-table-of-contents)

Each Markdown file (`.md`) in a documentation repository is published as a separate page of documentation, grouped by bundle and linked via the automatically-generated table of contents.

To edit the content of a custom docs page, use Code Repositories to create a new branch of the docs repository, modify the Markdown file, and commit/build your changes.

## Specify a page title

All content pages within a documentation bundle require the specification of a page title. This is done using the `@title` annotation at the top of each Markdown file (other than `overview.md`, which uses `@name`).

For example:

```
@title Example title

This is the text of the documentation page named "Example title in sentence case".
```

:::callout{theme="neutral"}
Note that the actual filename and page name specified with the `@title` annotation do not need to be the same.
:::

## Add the new page to `ordering.md`

Each page in a documentation bundle (other than the mandatory `overview.md`) must be specified in an `ordering.md` file in the documentation repository. The `ordering.md` enables you to structure and organize the documentation bundle with [section annotations](/docs/foundry/custom-docs/custom-docs-bundle-structure/). The left-hand table of contents is automatically generated with these section annotations.

[Learn more about organizing your documentation bundle.](/docs/foundry/custom-docs/custom-docs-bundle-structure/)

## Optional: Use a different label in the table of contents

The filename of a content page is used to generate the URL for that page, but the `@title` page title is used in the left-hand table of contents. If you want a page's label in the table of contents label to be different from the page's title (for instance, if the page title is very long), you can specify a table of contents label using the `@toc` annotation.

Building off the example above, we might have a file like:

```
@title Example long title in sentence case
@toc Example

This is the text of the documentation page named "Example long title in sentence case". The page's title will appear in the table of contents as "Example".
```
