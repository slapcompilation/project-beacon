<!-- source: https://palantir.com/docs/foundry/questions-answers/streaming/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Streaming

### Is there a default number of output partitions for a Flink pipeline and is it configurable?

The output is limited to 8 partitions by default when automatically computing the number of partitions, but this output can be set to a maximum of 16 in the pipeline settings.

*Timestamp:* March 2, 2024

### What is the best practice for converting a batch dataset to a stream for exporting to Kafka?

The best practice is to create a streaming pipeline in Pipeline Builder, using a batch dataset as the input and configuring the output as a stream. This stream can then be exported to Kafka, following the normal [Kafka streaming export documentation](/docs/foundry/available-connectors/kafka/#export-data-to-kafka).

*Timestamp:* March 26, 2024

### How can I replay a stream from a Java deployment UDF?

You can replay a stream by bumping the logic version in the pipeline configuration yaml file.

*Timestamp:* July 25, 2024
