<!-- source: https://palantir.com/docs/foundry/ai-fde/best-practices/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Best practices for using AI FDE

Review the following best practices to help you leverage AI FDE effectively while maintaining system integrity and optimizing results.

## Verify resources and procedures

Always verify generated resources before implementing them in production environments. This verification process should include reviewing all generated code for correctness and adherence to organizational standards.

Test transformation logic with representative sample data to ensure it performs as expected under various conditions. Note that AI FDE will make changes on a branch by default and propose its changes in a Global Branch proposal or Code Repository pull request for review.

Depending on the tool being used and tool configurations, AI FDE may ask for tool approval before performing an action. Ensure that you understand the action that the model is trying to execute, and that you check the tool being used before approving.

## Limit tools and context

We recommend that you provide the model with only the context and tools that are essential for a given task. Providing unnecessary context or tools can lead to suboptimal or incorrect actions. By restricting the available tools to only those required for a specific task, and including only the most relevant context, you can reduce the likelihood of confusion or error. Limiting tools and context can improve the efficiency and accuracy of AI FDE, as well as enhance security by minimizing access to sensitive operations or information.

## Decompose problems and use iterative development

Complex operations should be broken down into smaller, more manageable steps. We recommend that you start with basic structures and gradually add complexity as each component is verified.

AI FDE is particularly effective for rapid prototyping, allowing for quick exploration of different approaches. For production-quality implementations, combine AI-generated foundations with manual development for fine-tuning and optimization.

## Track performance with AIP Evals

Use [AIP Evals](/docs/foundry/aip-evals/overview/) to evaluate and track the performance of functions created or modified by AI FDE. Creating evaluation suites for your LLM-backed functions allows you to measure the impact of changes over time and compare different approaches. This is particularly valuable when using AI FDE for iterative function development, as it provides quantitative feedback on whether changes improve or degrade performance.

## Consider infrastructure constraints

When using AI FDE, it is important to acknowledge the differences in operational patterns compared to human developers. While human developers typically perform one operation at a time, often pausing to think between actions and taking breaks, AI FDE can execute operations in rapid succession, with only seconds between each action. This can trigger dozens of operations in minutes, running continuously until tasks are complete. Multiple AI FDE sessions may operate in parallel, compounding the overall impact on infrastructure. This can expose infrastructure bottlenecks that may be manageable for the slower, more sequential pace of human activity.

Give careful consideration to the following areas:

* Storage read/write
* Compute resources, particularly GPUs
* Storage capacity

AI FDE usage may require infrastructure that can accommodate high-frequency parallel operations, sustained compute loads, increased network activity, and expanded storage needs.
