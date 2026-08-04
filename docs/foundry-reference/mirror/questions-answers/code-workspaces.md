<!-- source: https://palantir.com/docs/foundry/questions-answers/code-workspaces/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Code Workspaces

### In a workspace application, how can I add dependencies like `dash-core-components` and `plotly`?

Dependencies from your JupyterLab® code workspace are automatically available in your published application using managed Conda/PyPi environments. Review [managed Conda/PyPi environments](/docs/foundry/code-workspaces/jupyterlab/#managed-condapypi-environments-in-jupyter-notebooks) for more information.

:::callout{theme="error"}
Adding dependencies to applications through the `environment.yml` file at the root of your repository is now **deprecated**. Please migrate to [managed Conda/PyPi environments](/docs/foundry/code-workspaces/jupyterlab/#managed-condapypi-environments-in-jupyter-notebooks). We will attempt to migrate your `environment.yml` file automatically when you restart your workspace after you enable this feature.
:::

*Timestamp:* Sept 24, 2024

### Why do Jupyter® notebooks disappear between workspace restarts, and how can this issue be prevented?

Jupyter® notebooks may disappear between workspace restarts if changes are not synced before restarting or if there is a failure in restoring from a checkpoint. The issue can be prevented by ensuring changes are regularly synced and by verifying the upload of checkpoints through workspace logs. Additionally, it is important to note that checkpoints get deleted after 30 days, so regular syncing is crucial to avoid losing work.

*Timestamp:* March 6, 2024
