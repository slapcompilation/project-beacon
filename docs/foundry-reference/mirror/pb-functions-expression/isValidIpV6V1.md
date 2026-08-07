<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isValidIpV6V1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is valid IPv6

> Supported in: Batch

Returns true if the input is a valid IPv6 address.

**Expression categories:** Cyber

## Declared arguments

* **Expression:** IP address to check.<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `ip`

| ip | **Output** |
| ----- | ----- |
| 001:0db8:85a3:0000:0000:8a2e:0370:7334 | true |
| 2001\:db8:85a3:0:0:8A2E:0370:7334 | true |
| 2001\:db8:85a3::8a2e:370:7334 | true |
| ::1 | true |
| fe80:: | true |
| :: | true |
| 0:0:0:0:0:0:0:1 | true |
| 2001\:db8:: | true |
| ::ffff:192.0.2.128 | true |
| 2001\:db8:0:0:1:0:0:1 | true |
| 1234:5678:9abc\:def0:1234:5678:9abc:def0 | true |
| abcd\:ef01:2345:6789\:abcd\:ef01:2345:6789 | true |
| 2001\:db8:1234:0000:0000:0000:0000:0001 | true |
| 2001\:db8:1234::1 | true |
| 2001\:db8:85a3::8a2e:37023:7334 | false |
| 2001\:db8:85a3::8a2e::7334 | false |
| 2001\:db8:85a3:0:0:8A2E:0370:7334:1234 | false |
| 2001\:db8:85a3 | false |
| 2001\:db8:85a3::8a2e:370g:7334 | false |
| ::ffff:192.0.2.999 | false |
| 2001\:db8:85a3:0:0:8A2E:0370:7334: | false |
| :2001\:db8:85a3:0:0:8A2E:0370:7334 | false |
| 2001\:db8:85a3:0:0:8A2E:0370:7334:: | false |
| GGGG\:db8:85a3:0:0:8A2E:0370:7334 | false |
| 2001-db8-85a3-0-0-8A2E-0370-7334 | false |
| 2001\:db8:85a3:0:0:8A2E:0370:7334/64 | false |
| 2001\:db8::/32 | false |
| *empty string* | false |
|     | false |
| 192.168.1.1 | false |
| *null* | false |

***
