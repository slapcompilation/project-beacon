<!-- source: https://palantir.com/docs/foundry/logic/core-concepts/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Core concepts

The following core concepts are essential to understanding and getting the most out of AIP Logic. You can learn more about applying these concepts in the [getting started](/docs/foundry/logic/getting-started/) tutorial.

## Logic function

A Logic function takes inputs like Ontology objects or text strings, and returns an output that can be a value (such as a string), an object, or an edit to the Ontology itself.

Logic functions can be leveraged and used like any other function in the platform, such as in Workshop modules. To edit the Ontology, Logic functions must be published and called from an action. For more information, see how to [use a Logic function](/docs/foundry/logic/getting-started/#use-a-logic-function) in an action.

## Blocks

Logic functions are composed of [blocks](/docs/foundry/logic/blocks/). Blocks can read or write to the Ontology, perform calculations, aggregate data, call functions, loop over collections, evaluate conditions, or interact with an LLM. Chain blocks to pass one block's output to subsequent blocks and construct complex operations.

## Evaluations

After publishing a Logic function, you can configure [Evaluations](/docs/foundry/aip-evals/overview/), which enable you to write detailed tests for your Logic functions. Evaluations for AIP Logic can be used to:

* Debug and improve Logic functions and prompts.
* Compare different models, like GPT-4 vs. GPT-3.5 on your functions.
* Examine variance across multiple runs of Logic functions.
* Run [experiments](/docs/foundry/aip-evals/experiments/) to test function parameters and identify the values that deliver the best balance between performance and cost.
* Diagnose failures with the Results view's built-in results analyzer, which groups failing test cases into root-cause categories and suggests targeted prompt edits.

To bootstrap an evaluation suite, select **Generate evals** from the **Evals** tab in the right sidebar. AIP Evals analyzes your Logic function — including all referenced object types, not just input and output types — and creates editable test cases and metrics that you can refine. See [AIP Evals: Getting started](/docs/foundry/aip-evals/getting-started/).

Evaluations also support optional evaluator metric types. If an optional metric does not apply to a test case, the result displays as **No value**, and AIP Evals excludes it from aggregated metric scores.

## Debugging

After composing a Logic function, you can run the function as a test. Running your function will open the **Debugger** panel, showing the LLM chain-of-thought (CoT) for the component blocks in the Logic function. Examining the LLM's CoT makes debugging easier by showing each individual step of the LLM’s "thought process" and providing information on any supporting tools used by the LLM.

## Execution modes

You can configure Logic functions to run in one of two execution modes: *user-scoped* or *project-scoped*. User-scoped execution runs the function using the permissions of the user running it, while project-scoped execution uses the permissions of the project containing the function. The execution mode also affects who can view execution logs. For more information, see [Execution mode settings](/docs/foundry/logic/execution-mode-settings/).
