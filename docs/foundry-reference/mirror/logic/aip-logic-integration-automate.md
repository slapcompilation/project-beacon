<!-- source: https://palantir.com/docs/foundry/logic/aip-logic-integration-automate/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# AIP Logic integration with Automate

AIP Logic can now be automated such that Ontology edits can be automatically applied or staged for human review. These automations can be triggered on existing objects or when new objects are created.

## Create a new automation from AIP Logic file

You can start creating a new automation from your AIP Logic file using the **Uses** option on the right side.

<img src="./media/logic-integration-2.png" alt="Uses panel for creating a new automation." width="250">

Doing so will prompt a new window with a pre-populated automation flow based on your Logic instructions.

![Automation configuration screen](/docs/resources/foundry/logic/logic-integration-3.png)

The condition you set up will monitor an object set and trigger the Logic effect for each new object added or automatically run edits. Learn how to [set up an automation](/docs/foundry/automate/getting-started/).

After confirming the name and settings of the new automation, select **Save automation**.

You will be redirected to the **Automation Overview** screen after saving.

![Automation overview page showing the options available to review agent proposals.](/docs/resources/foundry/logic/logic-integration-overview.png)

The Overview screen displays the automation flow, status, and event chart which updates automatically when the automation is triggered.

If you configured your automation to stage Actions for approval over automatically running edits, you can see an overview of Agent proposals that were generated and require a review by navigating to the **Proposals** tab using the left side navigation bar.

To review these agent proposals, do one of the following:

* Access the **Proposals** tab from the navigation bar.
* From the **Agent proposals** section, select **View**.

On the **Proposals** tab, select a specific proposal to inspect the reason it was created.

![Proposals page.](/docs/resources/foundry/logic/logic-integration-1.png)

Additionally, the proposed Action will be previewed at the bottom of the screen. By selecting the **Agent decision log** tab under **View proposal details**, you can inspect the decision process the LLM followed to generate the proposed Action.

When you accept a proposal, the Action will be automatically executed, and the proposal card will be moved to the **Applied** column.

## FAQ

The following are some frequently asked questions about the AIP Logic integration.

### Why can I not see any proposals?

For security considerations, open proposals are visible for only 24 hours and only to the user who created the automation. Older proposals will not be visible.

### Why is the **Create Automation** button unavailable?

The AIP Logic output must return an Ontology edit for the Automation to run.

### Why is there no condition block in the Automation summary page?

Ensure that the AIP Logic input is an object.
