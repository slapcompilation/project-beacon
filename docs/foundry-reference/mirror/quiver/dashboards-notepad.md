<!-- source: https://palantir.com/docs/foundry/quiver/dashboards-notepad/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Add to a Notepad document

There are two main ways to add a dashboard to a Notepad document: copy-pasting and embedding.

## Copy-paste to Notepad from a dashboard

Cards on a dashboard can be copy-pasted into a [Notepad document](/docs/foundry/notepad/overview/) using the **Copy for Notepad** action.

<img alt="Copy for notepad" src="./media/copy-for-notepad.png" width="400px">

Copying cells in which multiple parameters or metrics are bundled is not supported.

## Embed a dashboard in a Notepad document

Embedding a Quiver dashboard in a [Notepad document](/docs/foundry/notepad/overview/) allows you to export the dashboard to PDF or print it. Embedding dashboards also allows you to lock data at a point in time.

Follow the steps below to add a dashboard to a Notepad document.

* Open the Notepad document.
* Select the **+ Widget** button in the top bar.
* Choose **Quiver dashboard**.

![Notepad Quiver widget](/docs/resources/foundry/quiver/notepad-quiver-widget.png)

* In the configuration panel on the right, select the dashboard you want to embed.

<img alt="Notepad widget config" src="./media/notepad-quiver-widget-config.png" width="300px">

* Select the version of the dashboard you want to insert, or toggle **Auto-update** if you’d like the latest version to always be shown.
* Finally, if your dashboard has inputs defined, the inputs will be displayed in the **Dashboard inputs** section. You can map the inputs to variables in your Notepad document with the mapping table below.

|Quiver input type |Notepad input type |
| --- | --- |
| Boolean | String |
| Number | String |
| String | String |
| Time | String, in ISO format |
| Time Range | String, `ISO format - ISO format` |
| Time Series | *Not supported* |
| Object | Object |
| Object Set | Object Set |
| String List | String: `["option_1","option_2"]` |

In the example below, the dashboard has one object input that has been configured directly in the editor.

<img alt="Notepad widget inputs" src="./media/notepad-widget-inputs.png" width="300px">
