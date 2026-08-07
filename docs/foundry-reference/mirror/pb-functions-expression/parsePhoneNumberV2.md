<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/parsePhoneNumberV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Parse phone number

> Supported in: Batch, Streaming

Normalizes phone numbers to a common format, parsing them from various regions and formats. Phone numbers containing the + sign followed by the region code will be parsed correctly even if the region is not set. All other number formats require a region to be selected from the options provided in order for them to be correctly parsed. Phone numbers that cannot be parsed will result in nulls.

**Expression categories:** String

## Declared arguments

* **Expression:** Phone number to parse.<br>*Expression\<String>*
* **Format:** Format to parse the phone number to.<br>*Enum\<E164, E164\_DIGITS\_ONLY, INTERNATIONAL, NATIONAL, RFC3966>*
* *optional* **Region:** Region the phone number belongs to. Note: when region is not specified, parsing will be performed without it, which could lead to inaccurate or no result at all. This might be useful in case you have a variety of numbers and a single region cannot be assigned. Numbers containing country calling code will be parsed correctly even if the region is not set, but all other formats require a region to be selected.<br>*Enum\<Afghanistan, Albania, Algeria, American Samoa, Andorra, Angola, Anguilla, Antigua and Barbuda, Argentina, Armenia, and more ...>*

**Output type:** *Phone Number*

## Examples

### Example 1: Base case

**Description:** Should return parsed number in the E164 with digits only format.

**Argument values:**

* **Expression:** +1 415 5552671
* **Format:** `E164_DIGITS_ONLY`
* **Region:** `US`

**Output:** 14155552671

***

### Example 2: Base case

**Description:** Should return parsed number in the E164 format.

**Argument values:**

* **Expression:** +1 415 5552671
* **Format:** `E164`
* **Region:** `US`

**Output:** +14155552671

***

### Example 3: Base case

**Description:** Should return parsed number in the INTERNATIONAL format.

**Argument values:**

* **Expression:** +1 415 5552671
* **Format:** `INTERNATIONAL`
* **Region:** `US`

**Output:** +1 415-555-2671

***

### Example 4: Base case

**Description:** Should return parsed number in the NATIONAL format.

**Argument values:**

* **Expression:** +1 415 5552671
* **Format:** `NATIONAL`
* **Region:** `US`

**Output:** (415) 555-2671

***

### Example 5: Base case

**Description:** Should return parsed number in the RFC3966 format.

**Argument values:**

* **Expression:** +1 415 5552671
* **Format:** `RFC3966`
* **Region:** `US`

**Output:** tel:+1-415-555-2671

***

### Example 6: Base case

**Description:** Return formatted US phone number

**Argument values:**

* **Expression:** `phoneNumber`
* **Format:** `E164`
* **Region:** `US`

| phoneNumber | **Output** |
| ----- | ----- |
| (234) 235-5678 | +12342355678 |
| +1 415 5552671 | +14155552671 |
| (415) 5552671 | +14155552671 |
| Whatsapp@14155552671 | +14155552671 |

***

### Example 7: Null case

**Description:** If the phone number is un-parsable, the returned result is null

**Argument values:**

* **Expression:** `phoneNumber`
* **Format:** `E164`
* **Region:** *null*

| phoneNumber | **Output** |
| ----- | ----- |
| *null* | *null* |
| 9991-COMPANY | *null* |
| *empty string* | *null* |

***

### Example 8: Edge case

**Description:** Phone numbers that contained the + sign and region code will be parsed to that specific region format even if the region is not set. Phone numbers that are missing the region coderequire a region to be selected from the dropdown in order for them to be correctly parsed. In this example the region code was not set, therefore numbers from the first, third, forth and fifth rows were not parsed correctly.

**Argument values:**

* **Expression:** `phoneNumber`
* **Format:** `E164`
* **Region:** *null*

| phoneNumber | **Output** |
| ----- | ----- |
| (234) 235-5678 | *null* |
| +1 415 5551111 | +14155551111 |
| 1 415 555 1111 | *null* |
| +1 411 1111111 | *null* |
| +34 91 23 45678 | +34912345678 |
| Whatsapp@34912345678 | *null* |

***

### Example 9: Edge case

**Description:** All phone numbers containing a country code were correctly parsed, as well as the phone numbers from the region selected have been parsed correctly. The phone numbers not matching the region selected  were not parsed, as they were also invalid (too short or too long phone numbers).

**Argument values:**

* **Expression:** `phoneNumber`
* **Format:** `E164`
* **Region:** `US`

| phoneNumber | **Output** |
| ----- | ----- |
| (234) 235-5678 | +12342355678 |
| +1 415 5551111 | +14155551111 |
| 1 415 555 1111 | +14155551111 |
| +1 411 1111111 | *null* |
| +447945120071 | +447945120071 |
| 07945120071 | *null* |
| not\_a\_phone\_number | *null* |
| Whatsapp@+34912345678 | +34912345678 |

***
