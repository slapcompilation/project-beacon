<!-- source: https://palantir.com/docs/foundry/time-series/derived-series-permissions/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Derived series permissions

Derived series permissions are divided into the following groups:

* Create and update derived series resources
* View time series properties containing derived series
* Manage Ontology saving of the derived series

## Create and update the derived series resource

The derived series resource behaves just like any other Palantir resource. Review our [Projects and resources](/docs/foundry/getting-started/projects-and-resources/) documentation for more information. To create and update a derived series resource, users must have [object type edit permissions](/docs/foundry/object-permissioning/ontology-permissions-legacy/#create-new-resources-with-ontology-roles) on the bound object type.

## View time series properties containing derived series

To view a time series property containing a derived series, you must have access to all of the time series properties referenced by the derived series logic. You must also satisfy the requirements to view a time series property value. Review the [time series property permissions](/docs/foundry/time-series/time-series-permissions/#time-series-property-permissions) documentation for more details.

## Manage Ontology saving of the derived series

You can choose to enable automatic or manual Ontology saving for your derived series.

### Automatic Ontology saving

To use automatic Ontology saving you must satisfy the [submission criteria](/docs/foundry/action-types/submission-criteria/) for the required Action types. Remember, to enable automatic Ontology saving [you must create three separate Action types](/docs/foundry/time-series/derived-series-overview/#action-type-requirements-for-automatic-ontology-saving): `Create object`, `Modify object`, and `Delete object`.

Additionally, you must be able to view the objects of both the root object type and the sensor object type. Use caution when using automatic saving on restricted view object types as the Ontology status of a derived series is calculated against the objects that a user can view. For templated derived series, a user should have access to the entirety of the root object scope as well as its associated sensor objects to use automatic saving. Similarly, a single derived series should only be updated by a user that can view the associated single sensor object.

### Manual Ontology saving

To manually save derived series to the Ontology, you must have permissions to edit the bound object type's backing data source as well as Ontology edit permissions on the bound object type. Review how to [save a derived series to the Ontology](/docs/foundry/time-series/derived-series-create/#6-configure-ontology-saving-options) for more information.
