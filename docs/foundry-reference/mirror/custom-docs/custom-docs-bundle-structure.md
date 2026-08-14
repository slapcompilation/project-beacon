<!-- source: https://palantir.com/docs/foundry/custom-docs/custom-docs-bundle-structure/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Custom docs bundle structure

The `ordering.md` file for a custom documentation bundle determines the structure and organization of pages in the bundle. A [**section annotation**](#section-annotations) must be specified for each page in a documentation bundle; the [set of available section annotations](#summary-of-section-annotations) is predetermined and cannot be altered.

## File structure

Within your documentation repository, the structure of your project might look as follows:

```
docs/
├── product-A/
│   └── concepts
│       └── concept-doc.md
│   └── tutorials
│       └── tutorial-doc.md
│   └── ordering.md
│   └── overview.md
└── product-B/
    └── ...
```

* All documentation must be nested under the `docs/` folder as bundles (such as `product-A` above).
* These bundle folders map to the set of products that appear on the homepage of the in-platform custom documentation.
* All bundles should contain an `ordering.md` and `overview.md` file at the product folder level.
* The actual folders and files nested under each "product" (such as the `concepts` and `tutorials` folders in the example above) can be customized for your needs.

## Table of contents and `ordering.md`

Every documentation page in a bundle must be listed in the `ordering.md` file with a section annotation and the filename (without the `.md` extension). When the custom documentation service discovers and compiles the documentation, these section annotations are used to construct the left-hand table of contents.

### Section annotations

The in-platform custom documentation has a series of **section annotations** that you can use in the `ordering.md` file to determine how to organize your content pages.

The **section annotations** that currently exist are:

* `@quickstart`
* `@howto`
* `@tutorial`
* `@concept`
* `@resource`
* `@api`
* `@reference`

There is no requirement to use every section annotation in a documentation bundle. However, every page in a documentation bundle must have a section annotation.

### Summary of section annotations

The in-platform custom documentation service imposes a standard structure for documentation, enforced by section annotations. Below is a general guideline for the available sections; however, you should feel empowered to use the sections as you see fit.

* **Overview:** Generated from `overview.md`, this is the home page of a custom documentation bundle.
* **Quick Starts:** Brief guides to the fundamentals of the product. A first-time user would start here and walk away with enough knowledge to be able to start using the product.
* **Concepts:** Core ideas and concepts related to an application/service. This may not necessarily be actionable content, but describes key concepts that may be useful to describe how or why something works the way it does.
* **How To:** Guides that help users with common, generic, self-contained tasks.
* **Tutorials:** Step-by-step guides that a user can follow to achieve a specific outcome by completing a set of tasks. Tutorials can be used to outline end-to-end workflows and often use notional data to help users follow along.
* **References:** Technical references for syntax, types, and other information.
* **Resources:** Internal and external resources, such as useful links or FAQs.
* **APIs:** API endpoints of the product.

### Example `ordering.md`

Every page in a documentation bundle must be listed in the `ordering.md` with a section annotation and the filename (without the `.md` file extension). For example, an ordering file for Contour might look like:

```
@quickstart getting-started
@concept core-concepts
@resource faq
@howto boards-add
@howto boards-filter
@howto boards-join
@howto boards-verify-results
@reference boards-descriptions
@tutorial boards-map
```

The order in which the filenames appear in the `ordering.md` determines the order of the table of contents. The table of contents for the example `ordering.md` file above will contain a "How Tos" header with "Add boards" (`@howto boards-add`)  listed first, then "Filter boards" (`@howto boards-filter`), and so on.

## Nesting documentation with child pages

If you do not want a documentation page to show up at the top level of the table of contents, but instead want the page to be nested underneath another page, you can use child pages. There are two ways to declare child<>parent relationships in the custom documentation:

* \[Recommended] [Declare the child on the parent page](#declare-the-child-on-the-parent-page)
* \[Not recommended] [Declare the parent on the child page](#declare-the-parent-on-the-child-page)

### Declare the child on the parent page

You can nest pages as children of a parent page using the `@child` annotation on the parent page. This allows you to specify the order in which these child pages appear nested below the parent. For example, we might have `example-parent-page.md` with the following:

```
@title Parent

@child page-one
@child page-two
@child page-three
```

The order of the `@child` annotations determines the order in which the pages will be listed in the table of contents. Child pages do not need to be included in your `ordering.md` file. As long as parent pages are listed, the documentation service will publish the child pages.

### Declare the parent on the child page

:::callout{theme="warning"}
If you are referencing files in the same bundle, you should use `@child` and not `@parent`. `@child` allows you to specify the ordering of the children, so `@child` is strictly more expressive than `@parent`. `@parent` should only be used to add a child to a parent page that is not aware of the child’s existence (for example, adding a custom Contour board as a child under the Contour boards page in a different bundle).
:::

If you are writing a page and know that another page will be its parent, you can use the `@parent` annotation at the top of the file as follows: `@parent parent-filename`. You only need to use one of `@child` or `@parent`; there is no need to use both.
