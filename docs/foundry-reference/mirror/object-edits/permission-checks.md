<!-- source: https://palantir.com/docs/foundry/object-edits/permission-checks/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Permission checks when applying an Action

The permission checks when applying an Action depend on whether you are editing a [single-datasource object](#edits-of-single-datasource-objects) or a [multi-datasource object](#edits-of-multi-datasource-objects).

## Edits of single-datasource objects

If an object type is backed by a single datasource, Actions allow a user to edit an object as long as:

* The user can view/load the object (see the [Object Permissioning](/docs/foundry/object-permissioning/overview/) section for details), **and**
* The user passes [submission criteria](/docs/foundry/action-types/submission-criteria/#submission-criteria) defined in the action.

When creating new objects, the user must be able to view the input datasource of the object type; the Action run will fail if the user does not have access to the input datasource.

## Edits of multi-datasource objects

Object types can have properties that come from [more than one datasource](/docs/foundry/object-permissioning/multi-datasource-objects/). In these cases, users can have varying levels of access on a given object, as follows:

* User can view the entire object; for example, the user may have access to all datasources as well as all rows in these datasources.
* User can view a subset of datasources; for example, the user may have access to all rows in some datasources and none of the rows in the other datasources.
* User can view a subset of rows in subset of datasources; for example, the user may have access to the full object for some rows, partial access to objects for some rows, and no access to objects for the remaining rows.

If an object type has multiple datasources, the permission checks when applying an Action are more complicated, since enforcing constraints to ensure that the user must be able to view the entire object to edit it (as with single-datasource objects) can be very restrictive.

The following permission rules are implemented for different kinds of Actions that can be applied to an object.

### Create object

> Scenario: The given object exists in datasources `D[i..k, m..n]`. The user is creating the object by setting values for properties only in `D[i..k]`.

The user is not allowed to create the object unless they can view the backing datasource of `D[i..k]`. No permission is checked on `D[m..n]`. The values of `D[m..n]` default to `null`.

If any of `D[i..k]` contained the object in the past (but have the object marked as deleted now), the user must have permissions to see the row/object in all of `D[i..k]` in order to recreate the object.

### Edit or modify object

> Scenario: The object exists in datasources `D[i..k, m..n]`. The user is editing properties mapped to `D[i..k]`.

The user is allowed to edit properties provided they can view existing values of properties in `D[i..k]`. No permission is checked on properties mapped to `D[m..n]`.

`D[m..n]` will show up as `null` during the validation. The user can apply the Action if the validations pass with the `null` values.

### Delete object

> Scenario: The object exists in datasources `D[i..k, m..n]`.

The user is not allowed to delete the object if they cannot view the entire object (in other words, all the properties coming from `D[i..k, m..n]`).

### Create link

> Scenario: Object1 exists in datasources `D1[i..k]` and object2 exists in datasources `D2[m..n]`.

The user is allowed to create the link as long as they can load both object1 and object2 in any of the datasources `D1[i..k]` and `D2[m..n]`, respectively. No permission is checked on individual properties or datasources.

### Delete link

> Scenario: Object1 exists in datasources `D1[i..k]` and object2 exists in datasources `D2[m..n]`.

The user is allowed to delete the link as long as they can load both object1 and object2 in any of the datasources `D1[i..k]` and `D2[m..n]`, respectively. No permission is checked on individual properties or datasources.
