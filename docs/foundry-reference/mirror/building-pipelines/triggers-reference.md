<!-- source: https://palantir.com/docs/foundry/building-pipelines/triggers-reference/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Trigger types reference

Foundry supports arbitrary nesting of `AND` and `OR` triggers, enabling the creation of specific customized triggers.

## Time trigger

A time trigger is a trigger that is satisfied at specified instants in time.

:::callout{theme="neutral"}
A time trigger is only satisfied at the specified instants. After a specified instant has passed the time trigger is no longer satisfied.
:::

### Cron expression

A time trigger is defined using a [cron expression ↗](https://en.wikipedia.org/wiki/Cron) and a time zone.

:::callout{theme="success" title="Tip"}
The schedule editor provides an easy-to-use interface to define simple time triggers without having to write a cron expression.

More complex time triggers may require writing a custom cron expression.
:::

The schedule editor uses the standard Unix cron expression format with five fields:

```
+--------- Minute
| +------- Hour
| | +----- Day of Month
| | | +--- Month
| | | | +- Day of Week
| | | | |
* * * * *
```

:::callout{theme="neutral"}
Data Health uses the [Quartz cron format ↗](https://www.quartz-scheduler.org/documentation/quartz-2.3.0/tutorials/crontrigger.html#format) (six-parameter), not the [Unix cron format ↗](https://www.unix.com/man-page/linux/5/crontab) (five-parameter). Quartz implements an additional field for seconds, which is prepended to the standard Unix cron format.
:::

The schedule editor allows the following values for each field:

| Field | Allowed Values | Allowed Special Characters | Notes |
| --- | --- | --- | --- |
| Minute | 0-59 | `*` `-` `/` `,` | |
| Hour   | 0-23 | `*` `-` `/` `,` | |
| Day of Month | 1-31 | `*` `-` `/` `,` `L` | |
| Month | 1-12 or JAN-DEC | `*` `-` `/` `,` | |
| Day of Week | 0-6 or SUN-SAT | `*` `-` `/` `,`  `L` `#` | 7 is also Sunday |

The meaning of the special characters is detailed below:

* **Asterisk (`*`):** Specifies **all** values.

  *Examples*:

  | Minute | Meaning |
  | --- | --- |
  | `*` | Every minute |

* **Hyphen (`-`):** Specifies a **range** of values.

  *Examples*:

  | Minute | Meaning |
  | --- | --- |
  | `10-20` | The minutes between 10 and 20, inclusive |

* **Slash (`/`):** Specifies a **stepped range** of values.

  A stepped range may be defined using either a value or a range:

  * When used with a value, the range is from the specified value to the maximum value for that field
  * When used with a range, the range is the specified range

  *Examples*:

  | Minute | Meaning |
  | --- | --- |
  | `25/10` | Every tenth minute beginning from 25 (25, 35, 45, and 55) |
  | `25-45/10` | Every tenth minute between 25 and 45, inclusive (25, 35, and 45) |

* **Comma (`,`):** Specifies a **list** of values, ranges, and/or stepped ranges.

  *Examples*:

  | Minute | Meaning |
  | --- | --- |
  | `10,20,30` | Minutes 10, 20, and 30 |
  | `10,20-30` | Minute 10 and the minutes between 20 and 30, inclusive |
  | `10,25-45/10` | Minute 10 and every tenth minute between 25 and 45, inclusive |

* **L (`L`):** Specifies the **last** value.

  The meaning of `L` is dependent on how it is used:

  * When used in the Day of Month field, it specifies the last day of the month
  * When used in the Day of Week field by itself, it specifies the last day of the week (Saturday)
  * When used in the Day of Week field with a value, it specifies the latest day of the month with the specified day of week

  *Examples*:

  | Day of Month | Meaning |
  | --- | --- |
  | `L` | Last day of the month |

  | Day of Week | Meaning |
  | --- | --- |
  | `L` | Last day of the week (Saturday) |
  | `2L` | Last Tuesday of the month |

* **Hash (`#`):** Specifies the **nth day of week of the month**.

  *Examples*:

  | Day of Week | Meaning |
  | --- | --- |
  | `2#4` | Fourth Tuesday of the month |

The time trigger will be satisfied when the cron expression matches the current date and time.

:::callout{theme="neutral"}
If both the Day of Month and Day of Week fields are not `*`, the trigger will be satisfied if either matches the current date and time.
:::

*Examples*:

| Cron Expression  | Meaning |
| --- | --- |
| `30 9 * * 1` | 9:30am on Monday |
| `30 17 * 2 1` | 5:30pm on Monday in February |
| `0 9-17 10 * *` | Every hour from 9:00am to 5:00pm on the 10<sup>th</sup> of the month  |
| `0 9-17/2 10 * *` | Every two hours from 9:00am to 5:00pm on the 10<sup>th</sup> of the month |
| `0 9,17 10 * *` | 9:00am and 5:00pm on the 10<sup>th</sup> of the month |
| `0/5 9-17 15 3 *` | Every five minutes from 9:00am to 5:55pm on the 15<sup>th</sup> of March |
| `0/5 9,17 15 3 *` | Every five minutes from 9:00am to 9:55pm and from 5:00pm to 5:55pm on the 15<sup>th</sup> of March |
| `0 9 L * *` | 9:00am on the last of the month |
| `0 9 L 2 *` | 9:00am on the last of February |
| `0 9 * * L` | 9:00am on Saturday |
| `0 9 * * 2L` | 9:00am on the last Tuesday of the month |
| `0 9 * 4 3#1` | 9:00am on the first Wednesday of April |
| `0 9 20 * 4` | 9:00am on the 20<sup>th</sup> of the month and on Thursday |

### Time changes

All time triggers are evaluated using the wall-clock time in the specified time zone. A time trigger will be satisfied each time a wall-clock time occurs that satisfies the cron expression. Time changes are handled in the following way:

* If the time moves forward, a time trigger satisfied in between the time change will not be satisfied
* If the time moves backward, a time trigger satisfied in between the time change will be satisfied twice

*Examples*:

* If the time moves forward from 1:00am to 2:00am, a time trigger satisfied at 1:30am will not be satisfied because 1:30am never occurred
* If the time moves backward from 2:00am to 1:00am, a time trigger satisfied at 1:30am will be satisfied twice because 1:30am occurred twice

## Event trigger

An event trigger is a trigger that is satisfied once a specified event has occurred.

:::callout{theme="neutral"}
An event trigger remains satisfied after the event has occurred until the entire trigger is satisfied and the schedule is run.
:::

### Event types

The schedule editor currently supports the following event types:

* **New logic:** Occurs when the logic to compute a dataset is updated.
* **Data updated:** Occurs when a transaction is committed that updates a dataset.
* **Job succeeded:** Occurs when a job on a dataset is completed, regardless of whether a transaction was committed.
* **Schedule ran successfully:** Occurs when a scheduled build is completed successfully.

## Compound trigger

A compound trigger is created by combining multiple component triggers using `AND` triggers and `OR` triggers.

* An `AND` trigger creates a trigger that is the conjunction of its component triggers.
* An `OR` trigger creates a trigger that is the disjunction of its component triggers.

*Examples*:

In the following examples, `T1`, `T2` are time triggers and `E1`, `E2` are event triggers.

| Trigger | Meaning |
| --- | --- |
| `AND(T1, E1)` | Satisfied at `T1` if `E1` has occurred |
| `OR(T1, E1)` | Satisfied at `T1` or when `E1` occurs |
| `AND(T1, T2)` <sup>**\[1]**</sup> | Satisfied at times that satisfy both `T1` and `T2` |
| `OR(T1, T2)` | Satisfied at either `T1` or `T2` |
| `AND(E1, E2)` | Satisfied when both `E1` and `E2` have occurred |
| `OR(E1, E2)` | Satisfied when either `E1` and `E2` have occurred |
| `AND(T1, OR(E1, E2))` | Satisfied at `T1` if either `E1` or `E2` has occurred |
| `OR(T1, AND(E1, E2))` | Satisfied at `T1` or when both `E1` and `E2` have occurred |

**\[1]** Creating an `AND` trigger with multiple time triggers will only be satisfied when all time triggers coincide. For example, an `AND` trigger with a daily trigger and an hourly trigger will only be satisfied once per day. Instead, a more specific single time trigger should be used. In the previous example, the `AND` trigger should be replaced with just the daily trigger.
