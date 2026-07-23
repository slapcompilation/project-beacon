<!-- source: https://palantir.com/docs/foundry/data-integration/streaming-profiles/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Streaming profiles

When streaming with the Palantir platform, all aspects of configuring Flink runtime environments are managed for you, including reasonable and cost-effective defaults for Flink job configurations. In most cases, you do not need to configure anything yourself to start running a job on the Flink computation engine in a performant manner.

However, sometimes your job will require additional resources than what Foundry streaming provides by default. Such resources might include additional parallelism (if your stream has very high throughput, for example) or additional resources for JobManagers or TaskManagers that might be required if you have a very large state or very large records.

For these cases where your job requires additional resources, Palantir offers a set of job profiles that can be used to adjust specific configuration options. Note that we provide access to a limited set of the total available Flink configurations since the Palantir streaming platform can manage most things for you.

Similar to [Spark profiles in Code Repositories](/docs/foundry/optimizing-pipelines/spark-profiles-reference/), each streaming job profile manages a specific component of the streaming job’s resource requirements, and streaming job profiles can be composed with each other to meet your use case requirements.

## When to use streaming profiles

Typically, you should never need to use streaming profiles in the platform since our default streaming configurations are designed to be performant and cost-effective for a majority of use cases. However, we do recommend using streaming profiles only if you are encountering specific issues with your streaming job relating to the following:

* Very high throughput
* Very large records
* Very large state requirements

You can decide which additional profiles are needed by considering your job requirements, logs and error messages available within the JobTracker interface, and a basic understanding of Flink.

## Set up a streaming profile

The streaming profile set up interface will differ depending on where you are using the Foundry streaming platform.

In most cases, when setting up a streaming use case, you will notice a selection box that lists all streaming profiles available to you. For example, in [Pipeline Builder](/docs/foundry/pipeline-builder/overview/), you can see the list of configurable streaming profiles by selecting the build settings next to the **Deploy** button:

![Screenshot of Pipeline Builder Built-in Flink Profiles](/docs/resources/foundry/data-integration/pipeline-builder-built-in-flink-profiles.png)

Additionally, Pipeline Builder allows you to combine different aspects of these profiles together with the **Advanced** profile option:

![Screenshot of Pipeline Builder Advanced Flink profile.](/docs/resources/foundry/data-integration/pipeline-builder-advanced-flink-profile.png)

Note that the selection of streaming profiles available to you may differ based on which application you are using and any other security or visibility requirements applied to your working environment.

# Manage streaming profiles

Because streaming profiles can be used to determine the total number of resources allocated to perpetually running streaming jobs, several administrative controls are placed on these profiles to manage [streaming costs](/docs/foundry/building-pipelines/streaming-compute-usage/).

## Project references

In the Palantir platform, Projects define the conceptual boundary around related work and a security boundary for applying and managing access. The default application of security and administrative controls is at the Project level. Typically, using data or resources requires that they are present in or imported into your current Project, granting them a [Project Reference](/docs/foundry/code-repositories/use-project-references/). You can see all references in a Project in the **References** section of the Project workspace side panel.

The primary administrative control applied to streaming profiles is the requirement that they are added as Project references to the same Project as the related streaming pipeline or application. If you try to use a streaming profile that is not imported to your Project, your job will fail with an error indicating this missing requirement.

By using Project references as the administrative control, more advanced users can be granted the ability to import profiles into Projects on behalf of other users. This allows for administrators to control where streaming profiles are used at a granular level while allowing more operational users to use the profiles to which they have been granted access.

## Import profiles as Project references

Typically, profiles will be imported automatically into Projects within the relevant application by using the profile selector component. For example, the profile selector in Pipeline Builder will import the selected profiles automatically.

All users are able to import most profiles as Project references into their Projects, provided they have sufficient permission to import resources. This generally means that the user has been assigned a Role which grants them the `compass:import-resource-to` permission on the Project. You can find Role configurations by navigating to the **Roles** tab in your user **Settings**. Search for the permission using the `Filter operations...` search tool on the page.

To view a list of all available streaming profiles, visit the “Streaming profiles” tab in the “Enrollment Settings” section of Control Panel. From here you can pick any specific profile and see all Projects (to which you have access) where that profile has been added as a Project reference, as well as import it into new Projects. You can also remove references to a profile from an Project that it has been imported into; but note **this will break any streaming jobs in that Project that rely on that profile**, because we require that profiles be imported into the same Project as a streaming job in order to be used.

## Use large streaming profiles

For profiles that grant a large number of resources, Project references must be created using the **Streaming profiles** tab in the **Enrollment Settings** section of [Control Panel](/docs/foundry/administration/control-panel/). This setting is enabled only for users who are designated as `Enrollment Resource Administrators`. These administrators can be assigned in the **Enrollment permissions** tab and can import restricted profiles into any Project to which they have access.

Once an administrator imports a profile into a Project, any user who has access to that Project may then use that profile.
