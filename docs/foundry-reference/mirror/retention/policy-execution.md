<!-- source: https://palantir.com/docs/foundry/retention/policy-execution/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Retention policy execution

To execute the configured policies, all datasets are continuously evaluated in a loop. For each dataset, each policy is tested on all its transactions to determine which transactions need to be deleted. Depending on the number of datasets in an environment, this loop can take up to a few days to complete.

## Transaction-level marking

Retention policies mark transactions for deletion at the transaction level, and evaluate each branch of a dataset independently. By default, the latest view on any branch will not be marked for deletion. A view starts at the first transaction on a branch; a later `SNAPSHOT` transaction starts a new view, and every transaction after that `SNAPSHOT` belongs to the new latest view. If a policy runs on a branch and a transaction falls within that branch's latest view, it cannot be marked for deletion on that branch.

### Demonstration

As a single transaction can exist on multiple branches, the same transaction can simultaneously be in the latest view on one branch and outside it on another. Consider the following history, where branch `xyz` forks from `abc` at `T2`:

* Branch `abc`: `T1` (`APPEND`) → `T2` (`APPEND`) → `T3` (`SNAPSHOT`) → `T4` (`APPEND`)
* Branch `xyz`: `T1` (`APPEND`) → `T2` (`APPEND`) → `T5` (`APPEND`)

On branch `abc`, the latest view starts at `T3`, so `T1` and `T2` are outside the latest view and are eligible to be marked. On branch `xyz`, there is no `SNAPSHOT`, so the latest view starts at `T1` and contains every transaction — `T1` and `T2` are protected there. A retention policy running on `abc` would not mark `T1` or `T2`, because the same transactions are still in `xyz`'s latest view.

:::callout{theme="danger" title="Data loss risk with latest view deletion"}
You can override the default behavior by enabling the **Allow deletion from latest view** option in the **Advanced options** section of a retention policy. However, enabling this option may result in the deletion of current data that is still in use, and may cause incremental builds to fail. If you are using Python transforms with incremental pipelines, you must set the `allow_retention=True` parameter on the [`@incremental()` decorator](/docs/foundry/transforms-python/incremental-usage/#inputs-with-deletions-coming-from-retention) to prevent retention-related deletions from triggering a snapshot run.
:::

Learn more about configuring the [latest view transaction deletion](/docs/foundry/retention/manage-retention-policies/#latest-view-transaction-deletion) flag.

If multiple policies would select the same transactions, the first policy executed will just delete the transactions in question and any subsequent policies will ignore them.

## Mark and sweep

When a policy determines that a transaction should be deleted, it is first marked for deletion. Marking a transaction conveys that the data in the transaction may be deleted at any point, and so should not be read.

A marked transaction is indicated by the message "This transaction has been scheduled for deletion." visible in the dataset history page when a specific transaction is selected.

After a certain duration (usually 7 days, but this may vary) from the time of marking, a transaction will be swept. At this point, the data in the transaction will be deleted and cannot be recovered.

A swept transaction is indicated by the message "Transaction data has been deleted." visible in the dataset history page when the specific transaction is selected.

As a marked but unswept transaction still contains data, it is possible to unmark a given transaction in the event that it was incorrectly marked. To do so, first amend the policy or policies that mistakenly marked the transaction. Then, contact your Palantir representative within 7 days to assist with unmarking the transaction as the data will not be recoverable outside of this timeframe.
