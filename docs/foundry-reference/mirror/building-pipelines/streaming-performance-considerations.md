<!-- source: https://palantir.com/docs/foundry/building-pipelines/streaming-performance-considerations/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Performance considerations

As you prepare to create a stream in Foundry, it is important to consider the latency and throughput expectations that define your stream. This page will present some questions to consider regarding both latency and throughput performance for your stream use case.

## Latency

Latency is the speed at which stream records are processed. Latency is a core performance component that defines realtime streams, and the speed expectations from when your records process through a stream and arrive at their destination can have real-world impact. For example, stream latency determines how quickly alerts are triggered for airline flight delays or supply chain issues that require immediate action. The factors that impact latency are multi-faceted, but some of the most significant considerations are listed below.

### Latency factors

* How fast is the source producing data?
  * Foundry can only consume data as fast as it is produced, so you should ensure the data source is able to produce data quickly.
* How long does it take for the data to cross network boundaries?
  * When ingesting data into Foundry, the data often must pass across network boundaries which can introduce latency depending on network configuration, firewalls, and other factors.
* How many stages are in your end-to-end pipeline?
  * Foundry streaming will co-locate pipeline transformations defined in the same Code Repository or Pipeline Builder graph onto the same physical hardware to automatically optimize latencies. When more stages are added to the pipeline (for example, multiple repositories or Builder pipelines are chained together) we are unable to perform the same optimizations, incurring additional latency.
* Is data being sent to external systems?
  * For a record to be accessible in a low latency manner, the destination system must be able to process data in a low latency manner. Foundry offers optimized destinations, such as time series and the Ontology, but if data is traveling to external systems that system must support the latency requirements.
* What is the consistency model of your data?
  * Data consistency plays a significant role in end-to-end latency. Data that requires exactly-once guarantees (e.g. your record is guaranteed that it will be processed exactly one time) adds overhead and latency to ensure atomicity of your pipeline. If, however, your pipeline can run with at-least-once guarantees (e.g. each record is guaranteed to be processed at least one time, but may also be processed more than once), the system will automatically optimize your pipelines to make them run faster.

### End-to-end latency of a streaming pipeline

A standard streaming pipeline can run through the following stages in under 15 seconds:

* **Ingestion:** ~1-2 seconds
* **Transformation:** ~5 seconds if exactly-once is enabled (default), or 1 second if at-least-once is enabled
* **Syncing into a backing datastore (object storage sync or time series sync):** ~5 seconds if exactly once is enabled (default), or 1 second if at-least-once is enabled

As indicated above, there are three major factors that influence the end-to-end latency of a streaming pipeline:

1. The complexity of the pipeline based on the number of transforms.
2. The consistency model based on whether the pipeline is running at-least-once or exactly-once mode.
3. Time-based windows and aggregations in transforms. For example, if you specify that you want to aggregate over a 30-second window, then the data will implicitly have 30 extra seconds of latency for the aggregation.

## Throughput

Throughput is the amount of records that can be processed over a period of time. Throughput is often equally as important as latency for measuring the performance of a low latency pipeline, and some of the most significant considerations are listed below:

* How many records is your source producing per time interval?
  * Foundry’s streaming capabilities come with high throughput levels out of the box. However, if your source stream is producing at an exceptionally high rate, you can:
    * Increase the number of [partitions](/docs/foundry/data-connection/set-up-streaming-sync/#part-3-configure-the-streaming-sync) your stream uses to support those higher volumes.
    * Set an existing stream's stream type to "HIGH THROUGHPUT". This configuration increases the number of records your source sends in one batch and is recommended if you notice that your stream's "Total Lag" metric is greater than 0. Note that this setting directly trades off latency for throughput. Before proceeding, check your stream's "Total Throughput" metric to confirm that applying "HIGH THROUGHPUT" is the right choice for your stream.
* How CPU intensive is the processing portion of your pipeline?
  * Throughput can often be limited by delays in processing. There are many ways to increase throughput in processing, most of which can be solved by scaling the size of your processing cluster.
* How fast can your destination system receive records?
  * The stream destination system can also cause a delay if it cannot receive records as fast as they are produced. This can lead to [backpressure ↗](https://en.wikipedia.org/wiki/Back_pressure#:~\:text=Back%20pressure%20\(or%20backpressure\)%20is,a%20magnitude%20but%20no%20direction.), which decreases throughput and increases latency. Foundry’s streaming products are optimized and designed to keep up with extremely high throughputs. However, if you set a streaming pipeline to write to your own destination, you should ensure the destination can keep up with the volume of records produced.

## Advanced

* For users with an in-depth understanding of their data pipeline, another potential bottleneck for stream performance is network bandwidth. Symptoms of suboptimal network bandwidth include non-zero lag, lower than expected throughput, and records being dropped. To alleviate these symptoms, you can apply data compression to your stream. However, before doing so, keep in mind that:
  * Data compression works best on high volume streams with repetitive strings.
  * For lower volume streams whose primary concern is reducing latency, enabling data compression will further increase latency due to time spent compressing data in a suboptimal manner (for example, if there is a low volume of unique strings).
