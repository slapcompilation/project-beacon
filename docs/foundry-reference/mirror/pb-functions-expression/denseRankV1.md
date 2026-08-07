<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/denseRankV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Dense rank

> Supported in: Batch, Faster

Returns the rank of rows within a window partition, without any gaps. In case of ties the rows get same rank. The difference between rank and dense\_rank is that dense\_rank leaves no gaps in ranking sequence when there are ties.

**Expression categories:** Aggregate

## Declared arguments

This function does not take any arguments.

**Output type:** *Integer*
