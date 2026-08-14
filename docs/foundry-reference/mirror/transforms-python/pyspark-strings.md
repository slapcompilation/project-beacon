<!-- source: https://palantir.com/docs/foundry/transforms-python/pyspark-strings/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Strings

Strings refer to text data.

```python
from pyspark.sql import functions as F
```

## Converting between cases

* `F.initcap(col)`
* `F.lower(col)`
* `F.upper(col)`

## Concatenating, splitting

* `F.concat(*cols)`
* `F.concat_ws(sep, *cols)`
* `F.split(str, pattern)`

## Substrings

* `F.instr(str, substr)`
* `F.locate(substr, str, pos=1)`
* `F.substring(str, pos, len)`
* `F.substring_index(str, delim, count)`

## Trimming, padding

* `F.lpad(col, len, pad)`
* `F.ltrim(col)`
* `F.rpad(col, len, pad)`
* `F.rtrim(col)`
* `F.trim(col)`

## Regex

* `F.regexp_extract(str, pattern, idx)`
* `F.regexp_replace(str, pattern, replacement)`

## Misc

* `F.ascii(col)`
* `F.base64(col)`
* `F.bin(col)`
* `F.conv(col, fromBase, toBase)`
* `F.decode(col, charset)`
* `F.encode(col, charset)`
* `F.format_number(col, d)`
* `F.format_string(format, *cols)`
* `F.hex(col)`
* `F.length(col)`
* `F.levenshtein(left, right)`
* `F.repeat(col, n)`
* `F.reverse(col)`
* `F.translate(srcCol, matching, replace)`
* `F.unbase64(col)`
* `F.unhex(col)`
