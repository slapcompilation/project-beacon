<!-- source: https://palantir.com/docs/foundry/manage-models/set-up-checks/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Set up checks for all submissions

Modeling objective checks are a way to ensure that models pass predefined quality checks before a model is operationalized. Objective checks are customizable per objective and allow model reviewers with different expertise to collaboratively evaluate a model’s performance. This evaluation ensures that model status and discussions are transparent and organized to present a clear picture of a model’s quality to all stakeholders of a modeling objective.

For example, as the manager of a modeling project, you might want all candidate models submitted to your objective to be approved prior to release. Some approvals you may require could come from:

* A pipeline infrastructure team that confirms that your model passes the smoke tests.
* A data science team that is responsible for making sure the model's metrics meet the relevant requirements prior to deploying it to an operational application.
* An ethics team that ensures proper balance in the training data or that the model meets institutional fairness requirements.

For each of the checks above, focused discussion threads with the perspective reviewer groups or users can help with reaching a conclusion on the model’s readiness for deployment and to gather feedback for your next model iteration.

You can configure an objective check for each checkpoint above to create independent discussion threads for a focused collaboration space to evaluate all model submissions in the objective.

## Configure objective checks

To configure checks for your objective, go to the **Settings** page in the right sidebar and then navigate to the **Checks** tab. Here, you can create a new check with the name, description, and users or groups that are eligible to approve this check. In the example below, this check will be marked as approved if anyone from the `pcl-team` group or the `Administrators` group approves the check.

![Add a check panel](/docs/resources/foundry/manage-models/setup-configure-objective-check.png)

You can add additional checks based on your needs, or follow the example checks below.

![Checks panel in Settings](/docs/resources/foundry/manage-models/objective-checks.png)

## Collaborate on model submission evaluation with checks

Now that you have configured relevant checks for your objective, you can start collaborating with various reviewer groups to evaluate your model submissions.

On the model submission page, navigate to the **Checks** panel. Here, you can see the checks you have configured for your objective. Reviewers can approve, reject, or comment on each check when evaluating the model submission. Additionally, reviewers can add attachments (such as a screenshot of metrics) or tag user groups as they see fit.

Currently, it is not mandatory for all checks to be approved before creating a release for a model submission.

![Checks panel in model submission page](/docs/resources/foundry/manage-models/setup-submission-checks.png)

## Automatic evaluation-based checks

Checks can also be created where its status is based on the result of an evaluation performed on a given input dataset and evaluation library.

![The automatic check setup screen.](/docs/resources/foundry/manage-models/evaluation-checks-create-check.png)

The available choices of input dataset and evaluation library will be inherited from the evaluation configuration defined in the modeling objective's [evaluation dashboard](/docs/foundry/evaluate-models/model-evaluation-automatic/). In addition, the metrics built using the evaluation dashboard are used to determine the status of the check.

![An example of evaluation results.](/docs/resources/foundry/manage-models/evaluation-checks-evaluation-results.png)

The metric requirement defines the conditions for a submission to pass this check. A `PASS` status is achieved when the metric satisfies the requirement. If the metric fails the requirement or is not found in the set of metrics produced by the chosen evaluation library, a status of `REJECT` is given with a message describing the reason for rejection. If metrics were not yet built for the combination of submission, input dataset, and evaluation library associated with the check, the status of the check will be `PENDING`. A pending status will also occur if the metrics build fails.

![An automatic check result.](/docs/resources/foundry/manage-models/evaluation-checks-result.png)

## Archive a check

You can archive an objective check with the “disable” icon next to the check in the **Settings** page. Archived checks are no longer shown on the submission’s checks page by default. However, prior comments and approval histories for archived checks can be still seen by selecting the **View archive** button on the submission’s checks panel.

![Archive check setting](/docs/resources/foundry/manage-models/setup-archive-a-check.png)

## Filter models by check status

You can filter models in an objective based on the status of a particular check or the overall submission. This can help when you want to see which models have passed all the checks for deployment, or if you must review all submissions with a specific check pending.

Navigate to the **Models** tab on the left, then select the **All models** tab on top. Here, you can see a list of all model submissions along with their overall check status in the table. In the left panel, you can see a filter group under the label **Check status**. Here, you can select the check and its status you’d like to filter the submissions by.

![Filter models in an objective](/docs/resources/foundry/manage-models/setup-filter-submissions-by-check.png)
