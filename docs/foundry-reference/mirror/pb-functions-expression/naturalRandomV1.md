<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/naturalRandomV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Natural random number

> Supported in: Batch, Faster, Streaming

Returns a random natural number. This is not deterministic and will not produce the same result on repeated builds, even when using a seed.

**Expression categories:** Numeric

## Declared arguments

* **Max value:** Upper bound of the random value to be generated (exclusive).<br>*Literal\<Long>*
* **Min value:** Lower bound of the random value to be generated (inclusive).<br>*Literal\<Long>*
* *optional* **Seed:** Adding a seed means that the random numbers will be generated from same sequence at each build. If you want true random numbers this should not be supplied. A seed will not produce fully deterministic results since compute may run distributed and the order in which random numbers are pulled for rows is not guaranteed.<br>*Literal\<Long>*

**Output type:** *Long*

## Examples

### Example 1: Base case

**Description:** The only natural number between 10 (inclusive) and 11 (exclusive) is 10.

**Argument values:**

* **Max value:** 11
* **Min value:** 10
* **Seed:** *null*

**Output:** 10

***

### Example 2: Base case

**Description:** Generating a number between 10 (inclusive) and 15 (exclusive) with seed 1.

**Argument values:**

* **Max value:** 15
* **Min value:** 10
* **Seed:** 1

**Output:** 13

***
