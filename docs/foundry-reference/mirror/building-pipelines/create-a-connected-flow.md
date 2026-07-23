<!-- source: https://palantir.com/docs/foundry/building-pipelines/create-a-connected-flow/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Create a connected flow

In the Logic Flows App, you can:

* **Create new** connected flows (Top right corner)
* View existing connected flows, grouped by automation

To open the app, go to `/workspace/logic-flows`.

![Logic Flows home page](/docs/resources/foundry/building-pipelines/lf-app-homepage.png)

To create a connected flow in the [Compass Files Lister](/docs/foundry/building-pipelines/compass-file-lister/), follow these steps:

1. When creating a new connected flow, you will be presented with a dialog that allows you to set a name, project & required parameters and configuration. These are validated as it is being typed in or manually by clicking **Validate**. <br>For Compass Files lister automation, you are required to set input folder and output repository. <br><br>
   ![Connected Flow creation UI (filled)](/docs/resources/foundry/building-pipelines/lf-connection-ui-filled.png) <br><br>

:::callout{theme="neutral"}
Logic flows are *project-scoped*, meaning you must specify the project where the connected flow resource will be created. Connected flows should be saved in the same project as any parameters used to connect the flow.
:::

2. After saving the connected flow, it will appear in the list of connected flows. <br><br>
   ![Connected flows list](/docs/resources/foundry/building-pipelines/lf-connected-flow-list.png) <br><br>

3. To trigger the job, click **Build** in-line with the specific connected flow. A message will point you to the Builds application view where you can monitor the status of the job. <br><br>
   ![Builds application showing Logic flows job](/docs/resources/foundry/building-pipelines/lf-flow-run-builds.png) <br><br>

4. To check the results of your job, verify the pull request in the target repository view. <br><br>
   ![Pull Request on output repository](/docs/resources/foundry/building-pipelines/lf-compass-file-lister-pr.png) <br><br>

5. By heading back to Logic Flows application, you can see your connected flow, its parameters and configuration, and create a schedule from there. <br><br>
   ![Connected Flow view](/docs/resources/foundry/building-pipelines/lf-connected-flow-view.png)
