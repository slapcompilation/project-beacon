<!-- source: https://palantir.com/docs/foundry/api/v2/notepad-v2-resources/export-jobs/export-job-basics/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Export Job basics

ExportJobs are used to export content from notepad documents. After creating an ExportJob, the client should
monitor job status by getting the ExportJob and inspecting the 'status' property. If an ExportJob succeeds,
the client can download the exported content as a File.

ExportJobs are temporary resources intended for immediate use after creation; they must be used within
seven days. If an ExportJob cannot be found after seven days, it may have been deleted automatically.

The user must have export permissions on the export source to create an ExportJob. Once created an ExportJob
is only accessible to the user that created it.
