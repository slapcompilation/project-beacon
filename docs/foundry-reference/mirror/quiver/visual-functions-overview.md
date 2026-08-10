<!-- source: https://palantir.com/docs/foundry/quiver/visual-functions-overview/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Visual functions

**Visual functions** are reusable blocks of logic built using Quiver’s point-and-click interface. These functions can be used multiple times within the same or other Quiver analyses. Visual functions are published as an independent resource in Foundry and can be shared with other users who can also use them in their own Quiver analyses.

Visual functions allow you to:

* Build reusable logic using a point-and-click interface, without code,
* Collaborate with colleagues by building a shared library of reusable functions,
* Easily update common logic across multiple analyses in one place and reduce the risk of manual errors or mismatching logic,
* Simplify large analyses and improve loading and navigation performance.

## Inputs

A visual function contains zero or more inputs. Inputs are arguments of the function which can be configured by the user when consuming the function. Supported input types are: metrics, object sets, single objects or time series. Note that visualizations (categorical or not) and tables are not supported input types.

## Output

A visual function has one output. The output of the function is the result returned by the function. Supported output types are: metrics, object sets, single objects or time series.

Note that visualizations (categorical or not) and tables are not supported output types.

The function card, containing the output of the function, can be used as input to other cards in the Quiver analysis.

## Logic

The logic of a Quiver function is all the cards that are contained between the inputs and the output on the analysis graph.

Read more about [how to use visual functions](/docs/foundry/quiver/visual-functions-create/).
