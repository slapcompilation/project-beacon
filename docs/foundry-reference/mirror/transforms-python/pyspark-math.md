<!-- source: https://palantir.com/docs/foundry/transforms-python/pyspark-math/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Math

```python
from pyspark.sql import functions as F
```

## Rounding

* `F.bround(x, scale=0)`
  * Round the given value of column x to scale decimal places using `HALF_EVEN` rounding mode if `scale >= 0` or at integral part when `scale < 0`.

* `F.ceil(x)`
  * Computes the ceiling of the given value.

* `F.round(column, scale=0)`

* `F.floor(column)`

## Logarithms

* `F.log(arg1, arg2=None)`
* `F.log10(column)`
* `F.log1p(column)`

## Random

* `F.rand(seed=None)`
  * Independent and identically distributed (i.i.d.) samples from a uniform distribution \[0.0, 1.0]

* `F.randn(seed=None)`
  * Independent and identically distributed (i.i.d.) samples from the standard normal distribution

## Trigonometry

* `F.cos(x)`
  * Computes the cosine of the numeric column x.

* `F.sin(x)`

* `F.tan(x)`

* `F.acos(x)`
  * Computes the cosine inverse of a numeric column x; the returned angle is in the range `[0.0, π]`.
    cos<sup>-1</sup>(x)

* `F.asin(x)`
  * Computes the sine inverse of a numeric column x; the returned angle is in the range `[-π/2, π/2]`.
    sin<sup>-1</sup>(x)

* `F.atan(x)`
  * Computes the tangent inverse of a numeric column x.
    tan<sup>-1</sup>(x)

* `F.atan2(x, y)`
  * Returns the angle theta from the conversion of rectangular coordinates `(x, y)` represented by columns x, y to polar coordinates `(r, theta)`.

* `F.cosh(x)`
  * Computes the hyperbolic cosine of column x.

* `F.sinh(x)`

* `F.tanh(x)`

## Angles

* `F.degrees(column)`
* `F.radians(column)`

## Misc

* `F.abs(x)`
  * Absolute value of `x`
* `F.cbrt(x)`
  * Computes the **cube-root** of the given value.
* `F.exp(x)`
* `F.expm1(x)`
* `F.factorial(x)`
* `F.greatest(*cols)`
* `F.hypot(x, y)`
* `F.least(*cols)`
* `F.pow(x, y)`
  * `x` raised to the power `y`
* `F.rint(column)`
* `F.signum(column)`
* `F.sqrt(column)`
