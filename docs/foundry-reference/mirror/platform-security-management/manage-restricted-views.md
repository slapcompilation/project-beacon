<!-- source: https://palantir.com/docs/foundry/platform-security-management/manage-restricted-views/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Manage restricted views

## Use restricted views to back object types

To provide access to specific objects of a given object type in Object Explorer, set a restricted view as the backing dataset in the [Ontology Manager](/docs/foundry/ontology-manager/overview/). To successfully configure and save an object type backed by a restricted view, you must have `View` access to the input dataset of the restricted view.

## Restricted view file permissions

To create and edit restricted views, you must meet the following criteria granted within the Granular Permissions Administration workflow in the Roles interface. To access the Roles interface, navigate to Settings and select **Roles** in the Platform Settings section of the sidebar. Access to the Roles interface requires special platform permissions; contact your Palantir representative if you require this level of access.

|Role	|Description	|
|---	|---	|
|Create restricted view resource	|Needed on the folder/Project.|
|Create restricted view for dataset	|Needed on the dataset upstream of the restricted view.	|
|Edit resource granular policy	|Edit the granular policy on resources.	|
|Read resource granular policy	|Read the granular policy on resources.	|
|Edit restricted view resource	|Needed to make edits on the restricted view (policy, assume Markings).	|
|View restricted view resource	|View the properties of a restricted view (policy, assume Markings).	|
|View restricted view transaction	|See historical transaction metadata (policy, assume Markings).	|

To build a restricted view, you must have view access on the input dataset and edit permissions on the output restricted view.

To use a restricted view in a Contour analysis, you need the *Read restricted view* permission.

To configure and save an object type backed by a restricted view, you must have:

* View access to the input dataset of the restricted view.
* Edit access to the restricted view (to view/set/change policies).
* Be a member of the Ontology admin group (for access to the Ontology Manager).

To use granular policies on dataset-backed objects in Object Explorer, you must have *View ontology data source* permissions on the dataset to see any objects of this type.

## Restricted view policy management

Restricted view policies use [granular policies](/docs/foundry/platform-security-management/manage-granular-policies/) to determine which rows a user can access. Learn more about [designing granular policies](/docs/foundry/platform-security-management/manage-granular-policies/#design-granular-policies), [user attributes](/docs/foundry/platform-security-management/manage-granular-policies/#user-attributes), [policy comparisons](/docs/foundry/platform-security-management/manage-granular-policies/#policy-comparisons), and [policy limitations](/docs/foundry/platform-security-management/manage-granular-policies/#policy-limitations).

## Restricted view limitations

Restricted views are similar to datasets but have some key differences. The contents combine two dynamic factors: the policy definition and the user's attributes and group memberships at a specific point in time. The policy definition history is maintained in the transaction history. However, it is impossible for the transaction history to maintain a complete history of all user attributes and group memberships.

Restricted views are designed to simplify the analytical consumption of pipelines by individual users. They cannot be used as inputs to batch derivation jobs that produce new datasets (for example, [transforms](/docs/foundry/data-integration/data-pipeline/), Code Workbook outputs, or Pipeline Builder outputs that write to a dataset). Pipelines built in Foundry should be reproducible and agnostic to the specific user running them. This expectation is incompatible with restricted views, which provide row-level permissions that depend on user attributes.

This batch derivation restriction is an integrity property of the restricted view, not a confidentiality guarantee on the rows a user can read. The restricted view policy filters what a user can read and does not extend to downstream outputs or exports. For the full model, see [Access control propagation](/docs/foundry/security/access-control-propagation/).

* Users attempting to collaborate on a pipeline with restricted views may not have access to the policy statements and may not have the same set of user attributes and group memberships. Because of this, it is possible that each user may see different rows and aggregates in restricted views; users should not assume that workflows based on granularly permissioned data will behave the same as workflows based on regular dataset resources in Foundry.

* With downstream transformations, there is no enforcement to ensure that subsequent downstream transformations preserve the columns referenced by the policy. The read-only property of a restricted view protects its schema and columns from alteration; this is an integrity property of the resource, not a confidentiality guarantee on the rows a user can read. To keep data protected as it flows downstream, apply a [marking](/docs/foundry/security/markings/) or [Classification-based Access Control](/docs/foundry/security/classification-based-access-controls/) to the underlying data.

The following table summarizes the current limitations of restricted views:

| Operation	                           | Is this supported by restricted views?	 | Explanation	                                                                                                                                                                                                                                           |
|--------------------------------------|-----------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Reading	                             | Yes	                                    | Restricted views can be read via objects or in Contour.	                                                                                                                                                                                               |
| On-the-fly calculations	             | Yes	                                    | With restricted views, calculations can be performed from accessible rows via objects (such as in Quiver or Functions) or on datasets (with tools like Contour).                                                                                       |
| Writeback	                           | Yes	                                    | Objects based on restricted views can have defined writebacks. 	                                                                                                                                                                                       |
| Exporting	                           | Yes	                                    | Data from restricted views can be exported via Quiver, Contour, and other applications.	                                                                                                                                                               |
| Batch-processing	                    | No	                                     | Batch processing is not supported with restricted views, given that different users see different subsets of data.	                                                                                                                                    |
| Saving outputs as a Foundry dataset	 | No	                                     | Saving outputs based on transformations performed to restricted views is not supported; since Spark does not natively support row-level permissions, there is no way to enforce that subsequent transactions maintain the guarantees of restrictions.	 |
| Syncing to Postgres	                 | No	                                     | Syncing a restricted view to Postgres is not supported because row-level permissions that depend on user attributes would not be maintained.	                                                                                                          |

:::callout{theme="warning" title="Limitations are not confidentiality guarantees"}
The **No** rows in this table are integrity restrictions; the platform prevents these operations because the resulting output could not reliably reproduce the policy. They are not confidentiality guarantees on the rows a user *does* read. Data read through a restricted view can still be written, exported, or transformed through downstream operations whose own controls govern reuse. To keep data protected as it flows downstream, pair the granular policy with a [marking](/docs/foundry/security/markings/) or [Classification-based Access Control](/docs/foundry/security/classification-based-access-controls/). For the full model, see [Access control propagation](/docs/foundry/security/access-control-propagation/).
:::
