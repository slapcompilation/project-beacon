<!-- source: https://palantir.com/docs/foundry/logic/compute-usage/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Compute usage with AIP Logic

AIP Logic is a Palantir tool that allows you to quickly and maintainably build LLM-driven processes while interacting with your organization's data through the Ontology and computational functionality. AIP Logic is built around the concept of "blocks" of LLM instructions that can be combined linearly to create chain-of-thought workflows that can query data, execute actions and functions, and generate net new information for your use case. In AIP Logic, a "block" is the atomic unit of usage measurement, though each block can trigger other systems within Foundry that may also use compute-seconds to return information to the AIP Logic block.

:::callout{theme="neutral"}
If you have an enterprise contract with Palantir, contact your Palantir representative before proceeding with compute usage calculations.
:::

## Core concepts: Resource, blocks, and tools

An AIP Logic *resource* is comprised of one or more AIP Logic *blocks*. Running a resource will run the blocks required to achieve a desired output. Blocks can use *tools* such as Ontology queries, functions, and actions to produce an output.

## Measuring Foundry compute with AIP Logic

### AIP LLM tokens

LLM tokens in AIP are measured in the manner of the underlying model (such as [OpenAI ↗](https://platform.openai.com/tokenizer)), and depend on the size of prompts and responses as well as on the number of prompts that are made. For more information, consult the [table of usage for each model type](/docs/foundry/aip/aip-compute-usage/#measuring-compute-with-aip).

### LLM block execution

When an AIP Logic block executes or chooses to use a tool, there is a minimum compute-second usage.

* Basic LLM block execution: `4` compute-seconds
* LLM block tool execution: `8` compute-seconds

### Additional Foundry compute usage

When an AIP Logic block federates computation out to external tools (such as Ontology queries or functions), additional compute may be used during the execution of these applications.

## Managing AIP Logic usage of Foundry compute

Some operations in AIP Logic can significantly affect compute usage. Below, we provide guidance on controlling compute usage by being careful about [token usage](#token-usage), the [total number of logic block executions](#total-number-of-logic-block-executions), and usage of [Foundry compute](#foundry-compute).

### Token usage

* Processing large amounts of text can significantly increase overall compute usage. Be aware of the size of the input prompts that are being used with LLMs. This is especially relevant when pulling in large text blocks from the Ontology.
* To moderate token usage, you should work to pare down the amount of text that is injected into prompts and ensure that only relevant text is included in the prompts themselves. This is especially important when working with large documents.

### Total number of logic block executions

* Running many logic blocks can use large amounts of compute, especially if the blocks are triggered programmatically via a function (that is, not triggered by human action).
* To moderate logic block executions, consider combining multiple blocks into single prompts (where appropriate), and only using additional blocks when necessary. Action, function, and data transformation blocks do not incur compute usage on their own.

### Foundry compute

* Running many calls to Foundry applications (such as Ontology queries, functions, or actions) can use large amounts of compute. This may occur if a logic resource requires many retries, or calls many functions or actions on each execution.
* To moderate compute usage from other applications, ensure that you understand the number of calls to other tools that are made in your chain of logic blocks. The potential tools that can call out to other parts of Foundry are:
  * Ontology Query
  * Action Execution
  * Function Execution
  * Data Transformation

## Example of AIP Logic compute usage

Assume a user has an AIP Logic resource that has two LLM blocks. One of the LLM blocks has an action configured and will call it on execution. The logic resource is run end-to-end twice.

```
Number of LLM blocks: 2
Number of LLM blocks that call actions: 1
Number of runs: 2

1 run compute-seconds = 2 LLM blocks * 4 compute-seconds + 1 action block * 8 compute-seconds
1 run compute-seconds = (2 * 4) + (1 * 8)
1 run compute-seconds = 16 compute-seconds

2 runs = 2 * 16 compute-seconds = 32 compute-seconds

Total = 32 compute-seconds
```
