<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/lagV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Lag

> Supported in: Batch, Faster

Returns the value of the input at 'lag' before the current row in the window.

**Expression categories:** Aggregate

## Declared arguments

* **Expression:** Expression to lag.<br>*Expression\<T>*
* *optional* **Default value:** Default value if there is less than offset rows before the current row.<br>*Literal\<T>*
* *optional* **Lag:** Number of rows to lag.<br>*Literal\<Integer>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*
