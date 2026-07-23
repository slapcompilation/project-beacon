<!-- source: https://palantir.com/docs/foundry/building-pipelines/create-stream-pipeline-pb/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Create a streaming pipeline with Pipeline Builder

In this tutorial, we will use Foundry Streaming and Pipeline Builder to create a simple pipeline with an output of a single dataset with information on sensor temperatures. You will learn how to create a stream in Foundry, push records into that stream, and transform them in Pipeline Builder.

## Part 1. Initial setup

First, we need to create a new stream.

1. When logged into Foundry, navigate to a [Project](/docs/foundry/compass/move-and-share-resources/) in Foundry, select **+ New** in the top right corner, then select **Stream**.

![Screenshot of stream create dropdown](/docs/resources/foundry/building-pipelines/stream-create-dropdown.png)

2. Next, you will need to define your stream. For this guide, we will create a simple one partition stream and manually push records to it.

On the **Define** page, select **Normal** for the throughput and define a basic schema as: **sensor\_id:** `String`, **temperature:** `Double`.

![Screenshot of stream definition page](/docs/resources/foundry/building-pipelines/stream-define.png)

3. Select **Create stream**. This will take you to the **Connect** page where you can specify how to connect to the streaming data.

## Part 2. Push records into the stream

We are now ready to connect our stream. At this point, we could set up a streaming data ingestion task with a [source](/docs/foundry/data-integration/source-type-overview/). For this tutorial, we will instead manually push records to the stream with **Curl.**

1. First, select **Curl (Bash)** under the **Connect via API** section to set up authentication for your stream. We will use a personal token to submit records.

![Screenshot of stream connection page](/docs/resources/foundry/building-pipelines/stream-connect.png)

2. Select **Test with a personal token** and follow the on-screen prompts for generating a short-lived personal token.

   :::callout{theme="neutral"}
   Personal tokens should not be used for production pipelines. Production pipelines should use an [OAuth token workflow](/docs/foundry/platform-security-third-party/writing-oauth2-clients/#oauth2-api-reference).
   :::

![Screenshot of stream connection auth page](/docs/resources/foundry/building-pipelines/stream-push-auth.png)

3. Paste your generated token into the text box, then click **Next Step**.
4. Copy the **Curl** command. Open a terminal on your computer that can execute Bash and paste the command. Run the command in your terminal.

![Screenshot of stream push with curl page](/docs/resources/foundry/building-pipelines/stream-push-curl.png)

Within seconds, you will see a record appear in the stream viewer on the page:

![Screenshot of stream view records tab](/docs/resources/foundry/building-pipelines/stream-view-records.png)

We have now ingested streaming data in real time. Let’s transform that data now.

## Part 3. Transform a stream

1. Select the **Start pipelining** button to begin writing a basic streaming transform in Pipeline Builder.

![Screenshot of stream view records tab](/docs/resources/foundry/building-pipelines/stream-start-pipelining.png)

2. In the **Create new pipeline** modal, select the **Streaming pipeline** type, and click **Create Pipeline**.

![Screenshot of create builder stream pipeline](/docs/resources/foundry/building-pipelines/create-new-stream-pipeline.png)

This will create a pipeline for the input stream, displayed on a graph.

Selecting the input stream node will display a preview of the data. Note that the preview runs on a cold storage view of the stream; records from the stream will be delayed before they appear.

![Screenshot of builder graph with input stream](/docs/resources/foundry/building-pipelines/stream-input-pb.png)

3. Click on the input stream node on the graph and select the **Transform** action (the blue **T** icon next to the input node).

   This will open a list of all transforms currently supported for streams based on the input types of the columns in the stream. For this tutorial, we will convert all `sensor_ids` to uppercase, remove any whitespace on them, and filter by temperatures exceeding three degrees.

![Screenshot of builder stream transform dropdown](/docs/resources/foundry/building-pipelines/stream-transform-dropdown.png)

4. Select the **Uppercase** transform, choose the `sensor_id` column, and click **Apply**.

![Screenshot of builder stream uppercase transform](/docs/resources/foundry/building-pipelines/stream-uppercase-transform-pb.png)

5. Then, search for the **Trim whitespace** transform and select it. Choose the `sensor_id` column again, and click **Apply**.

![Screenshot of builder trim whitespace transform](/docs/resources/foundry/building-pipelines/stream-trim-whitespace-transform-pb.png)

6. For the final transform, first search for the **Filter** transform and choose **Keep rows**. Then, select the `temperature` column, set the filter to **greater than** `3`, and select **Apply**.

![Screenshot of builder filter transform](/docs/resources/foundry/building-pipelines/stream-filter-transform-pb.png)

7. Click **Apply all changes** to the top right of your screen. Then, select **Back to graph** to return to your pipeline.

![Screenshot of builder graph with transform](/docs/resources/foundry/building-pipelines/stream-transform-graph.png)

8. Select the **Transform path** node we just created, then click **New dataset**.

![Screenshot of builder graph creating new output](/docs/resources/foundry/building-pipelines/stream-transform-new-dataset-pb.png)

9. In the top right corner of the application, first click **Save** to apply all new changes to your pipeline. Then, click **Deploy** and **Deploy pipeline**.

:::callout{theme="warning"}
If you save your changes without deploying them, your pipeline logic will **not** update to the latest changes. You must deploy the pipeline to capture changes to transform logic.
:::

![Screenshot of builder graph deploy dropdown](/docs/resources/foundry/building-pipelines/stream-builder-graph.png)

10. Select the output stream node you just created, then click on the stream name above the **Data preview** section at the bottom of your graph.

![Screenshot of builder graph with deployed output](/docs/resources/foundry/building-pipelines/stream-deployed-builder-graph.png)

This will take you to the stream preview page with the output stream from your transform.

:::callout{theme="neutral"}
The streaming cluster takes about one minute to start, so you may not see records immediately. Once running, however, the cluster will process all new records in real time.
:::

![Screenshot of output stream](/docs/resources/foundry/building-pipelines/stream-view-output.png)

## Next steps

Now that you know how to create a simple streaming pipeline, learn more about managing streams by exploring how to [debug a failing stream](/docs/foundry/optimizing-pipelines/debug-stream/). For more advanced transform functionality, learn more about [Pipeline Builder](/docs/foundry/pipeline-builder/overview/).
