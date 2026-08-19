<!-- source: https://palantir.com/docs/foundry/api/notepad-v2-resources/generation-jobs/generation-job-basics/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Generation Job basics

GenerationJobs are used to generate content from templates. After creating a GenerationJob, the client should
monitor job status by getting the GenerationJob and inspecting the 'status' property. If a GenerationJob
succeeds, the client can save the generated content as a new Document or export it via an ExportJob.

GenerationJobs are temporary resources intended for immediate use after creation; they must be used within
one hour. If a GenerationJob cannot be found after one hour, it may have been deleted automatically.
