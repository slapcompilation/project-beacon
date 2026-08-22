<!-- source: https://palantir.com/docs/foundry/quiver/cards-formula-syntax/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Formula syntax

Quiver lets you plot custom mathematical expressions and specify filter conditions using formulas. We support the following constructs in formulas:

* [Values](#values)
* [Output types](#output-types)
* [Operators](#operators)
* [Built-in Functions](#built-in-functions)
* [Control Flow](#control-flow)
* [Language reference](#language-reference)

## Values

* **Number:** In addition to standard numbers such as `6`, `3.14159`, `-128`, Quiver also supports scientific notation: `1.602e-19`.
* **Plot Reference:** Each plot is assigned a parameter name when they are created, and you can reference plots using the `$` sign: `$A` refers to the plot with parameter name `A`, and `$A + $B` calculates the sum of the two plots.
* **Boolean Values:** Use the Boolean values `true` and `false` when using logical operators.
* **Time Reference:** Reference time in the formula using the functions `secondsSince("time")` and `millisecondsSince("time")`. The time term needs to be in [ISO-8601 format ↗](https://en.wikipedia.org/wiki/ISO_8601). For example, `secondsSince("1970-01-01T00:00:00+00:00")` evaluates to the number of seconds since January 1st, 1970 in UTC.
* **NaN:** Represent an undefined or unrepresentable value, such as nulls.

## Output types

Formulas can only output numbers or strings, not booleans. Additionally, the output must be *homogeneous*, meaning that a formula must consistently output only numbers or only strings across all evaluations.

If you need to output boolean-like values, consider these workarounds:

* **For numeric output:** Use `1` for true and `0` for false. For example: `$A > 0 ? 1 : 0`
* **For string output:** Use `"true"` and `"false"` strings. For example: `$A > 0 ? "true" : "false"`

## Operators

* **Numeric Operators:** Quiver supports `+`, `-`, `*`, `/`, and the remainder operator `%`: `10 % 7` evaluates to `3`. You could also use parentheses `()` to enforce precedence. These operators produce double precision numbers as results.
  * You cannot use `^` to do power operations. See the `pow` function below in [Built-in Functions](#built-in-functions) to do powers.
* **Comparison Operators:** Quiver supports `==` for equality, `!=` for inequality, and `>`, `<`, `>=`, `<=` for comparisons. These operators produce Boolean values as results.
* **Logical Operators:** You can combine Boolean values using logical AND (`&&`) and logical OR (`||`) operators. Quiver also supports the logical NOT operator (`!`), which inverts a Boolean value.
* **Bitwise Operators:** You can perform bitwise AND (`&`), bitwise OR (`|`), bitwise XOR (`^`), and bitwise NOT (`~`) on numeric values. You can also perform bitwise shifts: `<<` for left shift, `>>` for sign-preserving arithmetic right shift, and `>>>` for 0-padded logical right shift.

## Built-in Functions

Quiver supports the following list of built-in mathematical functions:

|Function Name      |Description|
|---                |---|
|`abs(a)`         |absolute value|
|`acos(a)`        |inverse cosine|
|`acosh(a)`       |inverse hyperbolic cosine|
|`asin(a)`        |inverse sine|
|`asinh(a)`       |inverse hyperbolic sine|
|`atan(a)`        |inverse tangent|
|`atanh(a)`       |inverse hyperbolic tangent|
|`atan2(a, b)`    |inverse tangent of two numbers (four-quadrant arc tangent); *a* is the *y* coordinate, *b* is the *x* coordinate.|
|`cbrt(a)`        |cube root|
|`ceil(a)`        |ceiling|
|`cos(a)`         |cosine|
|`cosh(a)`        |hyperbolic cosine|
|`exp(a)`         |natural exponential|
|`floor(a)`       |floor|
|`isfinite(a)`    |true if argument is neither infinite nor `NaN`|
|`isnan(a)`       |true if argument is `NaN`|
|`ln(a)`          |natural logarithm|
|`log10(a)`       |base 10 logarithm|
|`log2(a)`        |base 2 logarithm|
|`max(a, b, ...)`      |maximum of all given inputs|
|`min(a, b, ...)`      |minimum of all given inputs|
|`pow(a, b)`      |`a` to the power of `b`|
|`round(a)`       |round to the nearest integer|
|`signum(a)`      |sign function|
|`sin(a)`         |sine|
|`sinh(a)`        |hyperbolic sine|
|`sqrt(a)`        |square root|
|`tan(a)`         |tangent|
|`tanh(a)`        |hyperbolic tangent|

## Control Flow

Quiver supports the ternary operator `a ? b : c` to express “if `a` then `b` else `c`”. For example, at each point in time, `$A > 0 ? $B * 10 : $C * 10` takes on the value of `$B * 10` if the value of `$A` is greater than 0 at that time; otherwise, it takes on the value of `$C * 10`.

You can also use the `NaN` value to return an alternative value where the input series is missing values. For example, at each point in time, `@M != NaN ? @M : @K` takes on the value of `@M` if it has a numeric value; otherwise, it takes on the value of `@K`.

You can use the `return` and `skip` statements to stop “early”, and either return a value or indicate that no value should be returned (e.g. to filter out a point).

## Language reference

### Basic types and assignment

Variables are declared with the `var` keyword. The `=` sign is used to assign a value to a variable. Variables are numbers (double precision), booleans, or strings.

```
var a = 6;
var b = 3.14159;
var c = 1.602e-19; // Exponential notation is supported
var d = 1.602E-19; // Exponents are not case-sensitive

var boolean_example = true;
var boolean_example = false; // re-assign to false

var string_example = "high";
```

### Expressions

#### Numeric

You can combine literals and variables into more complicated expressions.

The basic mathematical operators are `+`, `-`, `*`, `/`. To calculate a remainder, use `%`.

```
var a = 2 + 2; // a has value 4
a = 3 * 7; // a has value 21
a = 3.5 / 7; // a has value 0.5
a = 10 % 7; // a has value 3
```

Operator precedence is as expected. You can use parentheses `(` `)` to group expressions together.

```
var a = 5 + 3 * 2; // a has value 11
var b = (5 + 3) * 2; // b has value 16
```

You can also use assignment versions of the five operators listed above.

```
var a = 10;
a *= 2; // a now has value 20
a += 3; // a now has value 23
a -= 5; // a now have value 18
a /= 3; // a now has value 6
a %= 5; // a now has value 1
```

#### Boolean

You can compare numbers using the comparison operators `<`, `<=`, `>`, `>=`. These operators produce a Boolean (`true` or `false`) result.

Equality can be checked with `==`, and inequality with `!=`.

These expressions can then be combined with logical operators `&&` and `||`.

You can use the `!` operator to invert a Boolean result (`true` becomes `false`, `false` becomes `true`).

#### String

Equality can be checked with `==`, and inequality with `!=`.

```
var a = "high";
var b = "low";

// compare values
var c = a == a; // true
var d = a != b; // true
```
