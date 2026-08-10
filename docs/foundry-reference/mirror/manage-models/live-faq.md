<!-- source: https://palantir.com/docs/foundry/manage-models/live-faq/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Modeling Objective live deployment FAQ

Below are some frequently asked questions about [Modeling Objective live deployments](/docs/foundry/model-integration/objectives/#live-deployments), which are distinct from [direct deployments](/docs/foundry/manage-models/create-a-model-deployment/) configured from the model page. Learn more about creating and setting up a [live deployment](/docs/foundry/manage-models/set-up-live/) and the [differences between live and direct deployments](/docs/foundry/manage-models/create-a-model-deployment/#comparison-direct-model-deployments-vs-modeling-objective-live-deployments).

## What conda packages/environment will be included by default with my released Python model?

Models will be packaged with the conda packages/environment configured in the model adapter of the published model. Palantir will also add necessary lightweight packages to serve your production model.

## What is the maximum amount of data that can be sent in a request to live?

By default, live accepts up to 50MB in a single request. This upper limit is configurable; contact your Palantir representative for more details.

## Can I create monitors for Modeling Objective live deployments?

Yes. Modeling Objective live deployment uptime can be monitored through a [monitoring view](/docs/foundry/monitoring-views/overview/).

## Can I include private libraries in addition to public libraries as part of my environment customization?

We support the use of private and public libraries to be imported into a submission environment.

* For public libraries, you need to ensure that the requested libraries are either available in a public channel (such as conda-forge)
  and those public channels are configured in a way that can be discovered within Foundry;
* For private libraries created within Foundry, the libraries must be [properly published per the Python Library instructions](/docs/foundry/transforms-python/share-python-libraries/#publish-a-python-library).

## Can I restrict who can create live deployments on my instance?

Yes. The ability to create live deployments can be permissioned separately from the ability to create batch deployments. Contact your Palantir representative for guidance.

## Can I scale up my Python models?

Yes, Foundry currently provides traffic scaling when deployed within Palantir's container infrastructure.

By default, each deployment is configured with 2 replicas, ensuring there is no downtime during upgrades. The default CPU and memory footprint is also low, resulting in a low default cost profile.

This can be [overridden for individual deployments](/docs/foundry/manage-models/set-up-live/#resource-configuration), to support larger models or higher expected load. Additionally, the default profile can be overridden for all live deployments via Control Panel.

## Can I run my Python models on GPU?

Yes. GPU support for Python models is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.

## Can I turn off my deployment to stop incurring cost?

Yes, you can [disable your live deployment](/docs/foundry/manage-models/set-up-live/#deployment-actions) via the individual deployment page.

When you are ready to start using it again, you can re-enable it via the UI as well. Note that the deployment will upgrade to latest release once it has been re-enabled.

Alternatively, you can also [delete a deployment](/docs/foundry/manage-models/set-up-live/#deployment-actions); this action cannot be reversed however, and you will no longer maintain the same Target RID.

## Can my Foundry ML Python models reach out to external APIs?

Yes. However, you (or an authorized administrator) must configure network egress for live deployments.

## Will a timeout occur during a live deployment request?

A five minute timeout will occur due to the default dialog read timeout, as running inference is a synchronous process.
