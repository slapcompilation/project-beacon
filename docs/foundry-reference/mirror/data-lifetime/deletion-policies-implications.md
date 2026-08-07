<!-- source: https://palantir.com/docs/foundry/data-lifetime/deletion-policies-implications/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Implications of deletion policies

:::callout{theme="warning"}
Data Lifetime is a valuable yet highly sensitive data governance tool that can lead to severe consequences if misused. Learn more about the [risks of Data Lifetime usage and explore safeguards to protect your organization](/docs/foundry/data-lifetime/getting-started/#safeguard-policy-use).
:::

## Fixed deletion date policy

When a fixed deletion date policy is applied to a dataset, all transactions across all branches will be assigned a deletion date. If the policy specifies an additional cutoff date, only the transactions that were committed before that cutoff will have a deletion date assigned; any later transactions will *not* be assigned a deletion date.

:::callout{theme="neutral"}
Data Lifetime will not consider policies from other services (the Retention application, for example) when computing deletion dates for transactions.
:::

## Keep latest view only policy

When a keep latest view only policy is applied to a dataset, certain actions may occur depending on the status of a transaction:

* If the transaction is in the latest view of the dataset, on a branch that is included in the set of policies configured for the policy, then the transaction will *not* receive an assigned deletion date. A transaction will not be marked for deletion if it is in the latest view on any one policy branch.
* If the transaction *is not* in the latest view of the dataset, the deletion date assigned to a dataset will correspond to the date of the newest transaction’s creation. This rule applies even if the transaction is in an older view within one of the policy's branches, or if the transaction is in the latest view on a branch not covered by the policy.

When a new transaction is added to a dataset with this policy, the following actions will occur:

* If the transaction is on a branch not covered under the policy, it will be assigned a deletion date that matches the transaction's creation date.
* If the transaction is on a branch covered by the policy and does not create a new view (an updated transaction), it will not receive a deletion date.
* If the transaction is on a branch covered under the policy and creates a new view (a SNAPSHOT transaction), it will not be assigned a deletion date. Instead, the dataset will be re-evaluated to place deletion dates on transactions in the previous view(s).

Similar to other policies, all downstream datasets and transactions will inherit the deletion date or its absence from their parent transactions.
