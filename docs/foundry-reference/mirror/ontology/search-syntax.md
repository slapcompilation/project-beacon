<!-- source: https://palantir.com/docs/foundry/ontology/search-syntax/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Search syntax

This page describes syntax for different kinds of searches in the Ontology. You can search in the Ontology from Workshop using the [filter list](/docs/foundry/workshop/widgets-filter-list/) or Object Explorer from the [search bar](/docs/foundry/object-explorer/search-objects/).

## Regular expression

Regular expression (regex) search in the Ontology uses a syntax that is similar to typical regular expressions but with some differences:

* String properties must be indexed for regex search. To use regular expression search on a string property, the property must be indexed for regex search in Ontology Manager. To configure this, navigate to the **Properties** tab of your object type and select the **Interaction** tab, then choose the **Enable regex queries** option.
* Patterns match the full value, not substrings. Because the index stores the complete string as a single unanalyzed value, a pattern is always matched against the entire field value from start to end. This means searching for `cat` will only match the exact value `cat`, not values that contain it such as `concatenate`. To perform a substring match, add `.*` before and after your pattern, for example, `.*cat.*` would match any value containing `cat`.
* `^` and `$` anchors are not supported. Because every match already implicitly starts at the beginning and ends at the end of the value, these anchors are redundant.

### Supported operators

* `.` matches any single character.
  * Searching for `c.t` would match `cat`, `cot`, `cut`, and so on.
* `?` makes the previous character optional (matches zero or one times).
  * Searching for `colou?r` would match both `color` and `colour`.
* `+` repeats the previous character one or more times.
  * Searching for `go+d` would match `god`, `good`, `goood`, and so on, but not `gd`.
* `*` repeats the previous character zero or more times.
  * Searching for `go*d` would match `gd`, `god`, `good`, `goood`, and so on.
* `{}` defines the minimum and maximum number of times the preceding character can repeat. `{2}` means the previous character must repeat exactly twice, `{2,}` means the previous character must repeat at least twice, and `{2,4}` means the previous character must repeat between 2 and 4 times (inclusive).
  * Searching for `go{2}d` would match only `good`. Searching for `go{2,4}d` would match `good`, `goood`, and `gooood`.
* `|` is the OR operator, allowing you to match one pattern or another.
  * Searching for `cat|dog` would match either `cat` or `dog`.
* `()` forms a group within an expression so that operators can apply to the entire group rather than just the previous character.
  * Searching for `(un)?happy` would match both `happy` and `unhappy`, because the `?` makes the entire `un` group optional.
* `[]` matches any single character listed inside the brackets.
  * Searching for `gr[ae]y` would match both `gray` and `grey`. You can use `-` to define a range, so `[a-z]` matches any lowercase letter, `[0-9]` matches any digit, and `[A-Za-z]` matches any letter regardless of case. If the sequence begins with `^`, the set is negated, so `[^0-9]` matches any character that is not a digit. If `-` is the first character or escaped with `\`, it is treated as a literal dash.
* `"` creates groups of string literals, allowing you to match an exact phrase rather than interpreting each character as a regex operator.
  * Searching for `"v2.0"` would match the literal text `v2.0`. Without the quotes, the `.` would be treated as a wildcard, potentially matching `v2X0` or `v200`.
* `\` is used as an escape character, allowing you to search for characters that would otherwise be treated as operators. It also provides shorthand character classes:
  * `\d` matches any digit (`0`-`9`). `\D` matches any character that is not a digit (letters, punctuation, spaces, and so on).
  * `\s` matches any whitespace character, such as spaces, tabs, and newlines. `\S` matches any character that is not whitespace.
  * `\w` matches any word character (letters, digits, and underscores: `a`-`z`, `A`-`Z`, `0`-`9`, `_`). `\W` matches any character that is not a word character, such as punctuation, spaces, and so on.
  * For example, searching for `\d{3}-\d{4}` would match patterns like `555-1234` or `800-5678`. Searching for `\w+\s\w+` would match any two words separated by a space, such as `hello world` or `John Smith`. To search for a literal dot, use `\.`. For example, `example\.com` would match `example.com` without matching `exampleXcom`.
