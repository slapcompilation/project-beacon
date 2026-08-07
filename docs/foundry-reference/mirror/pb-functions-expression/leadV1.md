<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/leadV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Lead

> Supported in: Batch, Faster

Returns the value of the input at 'lead' after the current row in the window.

**Expression categories:** Aggregate

## Declared arguments

* **Expression:** Expression to lead.<br>*Expression\<T>*
* *optional* **Default value:** Default value if there is less than offset rows before the current row.<br>*Literal\<T>*
* *optional* **Lead:** Number of rows to lead.<br>*Literal\<Integer>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*
