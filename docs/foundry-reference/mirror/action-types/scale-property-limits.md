<!-- source: https://palantir.com/docs/foundry/action-types/scale-property-limits/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Scale and property limits

Several limits are in place to ensure edited object types can quickly process edits and update user-facing data without slowing down live applications. Actions submitted that exceed these limits will not succeed and will display an error message to the user.

## Configuration limits

The `Allow multiple values` toggle allows users to pass in a list of values to a parameter.

| Limit                                                                   | Maximum |
| ----------------------------------------------------------------------- | ------- |
| Number of elements in a primitive list parameter                        | 10,000  |
| Number of elements in an object reference list parameter                | 1,000   |
| Number of elements in a list parameter when used in submission criteria | 1,000   |

## Edit limits

| Limit                                                                 | Maximum                 |
| --------------------------------------------------------------------- | ----------------------- |
| Number of **object types** you can edit in a single action submission | 50                      |
| Number of **objects** you can edit in a single action submission      | 10,000                  |
| Each individual edit of an **object** in an action submission         | 32KB (OSv1), 3MB (OSv2) |

## Batch call limits

An action can be called a maximum of 10,000 times in a batch. This limit is reduced to 20 when the action is function-backed and the function is not configured to use [batched execution](/docs/foundry/action-types/function-actions-batched-execution/).

The edits applied in a batched action call are treated as a single group when enforcing [edit limits](#edit-limits), regardless of which request in the batch was the cause of the edits.

Additional limits may apply, depending on the calling application.

## Supported property types

Below are specifications for supported single and array property types. Note that some property types are only supported by Object Storage v2 (OSv2).

### Single property types

| Property type | Parameter type | Supported |
| ------------- | -------------- | --------- |
| Attachment | Attachment | Yes |
| Boolean | Boolean | Yes |
| Byte | Integer | Yes |
| Cipher text | String | Yes |
| Date | Date | Yes |
| Decimal | Decimal | Yes |
| Double | Double | Yes |
| Float | Double | Yes |
| Geopoint | Geopoint | Yes |
| Geoshape | Geoshape | Yes |
| Geotemporal series reference | Geotemporal series reference | Yes (OSv2 only) |
| Integer | Integer | Yes |
| Long | Long | Yes |
| Mandatory control | - | Not supported as a property or in actions |
| Media reference | Media reference | Yes (OSv2 only) |
| String | String | Yes |
| Short | Integer | Yes |
| Struct | Struct | Yes (OSv2 only) |
| Timestamp | Timestamp | Yes |
| Time series reference | Time series reference | Yes (OSv2 only) |
| Vector | Double list | Yes (OSv2 only) |

### Array property types

| Array property type | List parameter type | Supported |
| ------------- | ------------------- | --------- |
| Attachment | Attachment | Yes |
| Boolean | Boolean | Yes |
| Byte | Integer | Yes |
| Cipher text | String | Yes |
| Date | Date | Yes |
| Decimal | Decimal | Yes |
| Double | Double | Yes |
| Float | Double | Yes |
| Geopoint | Geopoint | Yes |
| Geoshape | Geoshape | Yes |
| Geotemporal series reference | Geotemporal series reference | No |
| Integer | Integer | Yes |
| Long | Long | Yes |
| Mandatory control | Mandatory control | Yes |
| Media reference | - | Not supported in actions |
| String | String | Yes |
| Short | Integer | Yes |
| Struct | Struct | Yes (OSv2 only) |
| Timestamp | Timestamp | Yes |
| Time series reference | - | Not supported as a property or in actions |
| Vector | - | Not supported as a property or in actions |

## Supported properties

Currently, actions cannot be used to edit the **primary key** of an object. Modifying the primary key is equivalent to deleting an object and then adding a new object; instead of editing the primary key with an action, you can create or delete an object directly using [rules](/docs/foundry/action-types/rules/#ontology-rules).

## Notification recipients

When using [side effect notifications](/docs/foundry/action-types/notifications/), a maximum of 500 recipients can be notified in a single action. This limit is reduced to fifty recipients when notifications content is rendered "From a function". For further information about limits to account for when generating notifications, see the documentation on [maximum recipient limits for notifications](/docs/foundry/action-types/notifications/#maximum-recipient-limits).
