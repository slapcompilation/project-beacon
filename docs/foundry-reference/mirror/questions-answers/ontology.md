<!-- source: https://palantir.com/docs/foundry/questions-answers/ontology/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Ontology

### How do I edit the granular policies on a materialized Restricted View (RV) of an OSv2 object type?

To edit the granular policies on a materialized Restricted View (RV) of an OSv2 object type, you must edit the policies on the RV backing the object type, which will then propagate to the materialized RV.

*Timestamp:* April 10, 2024

### Is it possible to attach multiple unstructured files to an object by populating a property with an array of RIDs?

No, it is not possible to attach files in that manner. You need to explicitly parent the attachment through an action.

*Timestamp:* April 16, 2024

### Will moving columns between two Restricted Views in a MDO object change the property's API name and RID?

The identifiers will remain the same when moving columns between Restricted Views, so the property API name and property rid will not change.

*Timestamp:* April 16, 2024

### In a scenario where the "Apply most recent value" strategy is selected as the edit conflict resolution, if a user edits a field that was previously `null`, and the pipeline runs but the field remains `null` in the pipeline, what will be shown for the property?

When the pipeline runs, if the *timestamp* property updates to a more recent timestamp than the edit, the property will revert to `null`. If the timestamp property remains the same (or is `null`), then the user's edit will win.

*Timestamp:* June 13, 2024

### How can I map `true` or `false` to "Yes" or "No" in an action form without converting the property to a string?

This can be achieved through the **Constraints** section of the Boolean property configuration by selecting **Multiple choice** and **Define options manually**, then setting different display values for `true` and `false`.

*Timestamp:* June 26, 2024

### If a new object is created through an Action and it is backed by a Restricted View, will it be visible to all? Will specifying a value in a certain column restrict access according to that column?

Yes, the visibility of the object is based on the Restricted View policy. If an object is created without specifying anything in the column(s) used in the Restricted View policies, the object's visibility will depend on those policies, which could result in it being hidden from everyone.

*Timestamp:* June 25, 2024

### What are the consequences of changing a materialization's column names on Ontology edits?

Changing the materializations only affects the materializations themselves and anything downstream. It will not affect the edits information stored in Object Storage v2.

*Timestamp:* March 7, 2024

### What are `geohash` properties?

`Geohash` properties are a legacy type that was used in the Ontology to represent geospatial data. They have been renamed to `geopoint` for improved clarity, without any functional changes.

*Timestamp:* May 13, 2025
