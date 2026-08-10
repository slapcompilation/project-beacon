<!-- source: https://palantir.com/docs/foundry/data-lifetime/FAQ/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# FAQ

### How do I find the transaction ID of a dataset to use the transaction filter in the Data Lifetime application?

To find a transaction ID, navigate to the relevant dataset. Select the **History** tab, then choose the specific transaction you need. Scroll to the end of the **Transaction details** section to view the **Transaction RID** field. Copy the RID and paste it into the dedicated filter in the Data Lifetime application.

### Does the **History** tab within a policy allow me to view when a dataset was deleted?

No, the *Removals* section only refers to when a [dataset](/docs/foundry/data-integration/datasets/) was removed from a policy. Deletions can be tracked from the **Deletion** tab, found in the upper right corner of your screen.

### Can deletion policies be applied to media sets or model assets?

Currently, Data Lifetime policies can only be applied to datasets.

### I have concerns regarding compute costs after initiating a sizable deletion request. Could you provide more information about the potential implications?

The Data Lifetime application rate limits the evaluation of policies and transaction deletions. While protecting resources by limiting the number of requests, it improves performance by controlling the rate of incoming requests and ensuring the completion of prior requests. This resource conservation and performance boost reduces the need for additional resources, leading to cost control.

### How long does it take to delete previous transactions after a new SNAPSHOT is built, specifically if I have a "latest view only" policy?

Data Lifetime marks transactions for deletion at multiple points during the day, but the underlying data stores used by Foundry (such as S3) often take time to delete. Typically, the longest duration you can expect for data to be fully deleted is around 30 days.
