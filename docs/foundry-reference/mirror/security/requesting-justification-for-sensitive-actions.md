<!-- source: https://palantir.com/docs/foundry/security/requesting-justification-for-sensitive-actions/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Requesting justification for sensitive actions

Use [Checkpoints](/docs/foundry/checkpoints/overview/) to request justification for sensitive actions by following the steps below:

1. First, determine which type of action should require justification, and verify that there is a corresponding [checkpoint type](/docs/foundry/checkpoints/checkpoint-types/).
2. Follow the checkpoints [configuration guide](/docs/foundry/checkpoints/configure-checkpoints/) to set the parameters and conditions of the justification prompt.
3. In the **Configuration** tab of the [Checkpoints application](/docs/foundry/checkpoints/overview/#access-the-checkpoints-application), find your newly-created [checkpoint configuration](/docs/foundry/checkpoints/core-concepts/#checkpoint-configurations) and use the **Preview** feature to view the prompt interface users will see. Make changes as needed.
4. Trigger a checkpoint by attempting a sensitive action that will match the configuration, complete the justification, and submit. Try [reviewing records](/docs/foundry/checkpoints/review-checkpoint-records/) to find a copy of your justification.
