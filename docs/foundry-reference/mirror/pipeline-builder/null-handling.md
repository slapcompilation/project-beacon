<!-- source: https://palantir.com/docs/foundry/pipeline-builder/null-handling/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Null handling

A `null` value represents missing or unknown data. This page explains how Pipeline Builder treats `null` values in the conditions used by filters, [joins](/docs/foundry/pipeline-builder/transforms-join-data/), and the [Case](/docs/foundry/pipeline-builder/functions-index/#case) transform.

## Conditions and null

Filters, Case conditions, and join match conditions all evaluate a boolean condition that can return one of three results: `True`, `False`, or `null`. A condition is only satisfied when its result is `True`. A `False` or `null` result does not satisfy the condition.

## Equality conditions

A comparison is *null-safe* when it treats `null` as a value it can match, rather than returning `null` on `null` input.

Pipeline Builder offers two forms of equality which differ in null-safety:

* **is equal to** and **is not equal to** are null-safe: comparing `null` to `null` returns `True`, and comparing `null` to any other value returns `False`. Use these when you want `null` values compared and matched.
* **is equal to (not null safe)** and **is not equal to (not null safe)** return `null` if either side is `null`. Use these when you want values that involve `null` to be excluded.

To test only for missing data, use **is null** and **is not null**. These always return `True` or `False`.

## How each transform uses the result

* **Filter:** Keeps a row only when the condition is satisfied. Rows that return `False` or `null` are removed.
* **Case:** Evaluates each branch condition in order and returns the value of the first branch with its condition satisfied. A condition that returns `null` is not satisfied and that branch is skipped, so the row falls through to the next branch or to the default value.
* **Join:** Matches two rows only when the match condition is satisfied. A condition that returns `null` is not satisfied, so the rows do not match. In an inner join, unmatched rows are dropped; in a left, right, or outer join they are kept with `null` filled in for the columns from the non-matching side.

When a condition compares a column that may contain `null` values, use null-safe equality or an explicit **is null** check so that missing data is handled the way you intend.
