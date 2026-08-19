<!-- source: https://palantir.com/docs/foundry/api/general/overview/errors/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Errors

This API can return the errors documented below. Note that all errors returned by this API are compliant and consistent with [HTTP status code semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-status-codes). Errors are in JSON format and
include an error name, error code, error instance ID (which can be provided to
Palantir support), and additional parameters to assist in debugging. They will
be returned with a `4xx` or `5xx` status code. For example, a request for an `employee` object that does not exist might look like the following.

```json
{
    "errorCode":"NOT_FOUND",
    "errorName":"ObjectNotFound",
    "errorInstanceId":"00813215-0844-4716-be7b-a3fe0fce9e42",
    "parameters":{
        "objectType": "employee",
        "primaryKey": {
            "id": 10000
        }
    }
}
```


## Ontologies errors

| Error name                           | Error code        | Status code | Description                                                                                                                                                            | Additional parameters                                                   |
|--------------------------------------|-------------------|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------|
| `ActionEditedPropertiesNotFound`     | INVALID_ARGUMENT  | 400         | Actions attempted to edit properties that could not be found on the object type.                                                                                       | `parameters`                                                            |
| `ActionParameterObjectTypeNotFound`  | NOT_FOUND         | 400         | The parameter references an object type that could not be found, or the client token does not have access to it.                                                       | `parameterId`                                                           |
| `ActionParameterObjectNotFound`      | NOT_FOUND         | 400         | The parameter object reference or parameter default value is not found, or the client token does not have access to it.                                                | `parameterId`                                                           |
| `ActionTypeNotFound`                 | NOT_FOUND         | 404         | The requested action could not be found, or the client token does not have access to it.                                                                               | `actionType`                                                            |
| `ActionValidationFailed`             | INVALID_ARGUMENT  | 400         | The validation failed for the given action parameters. Please use the `validateAction` endpoint for more details.                                                      | `actionType`                                                            |
| `AggregationGroupCountExceededLimit` | INVALID_ARGUMENT  | 400         | The number of groups in the aggregation exceeded the allowed limit. Use `maxGroupCount`, larger intervals, or a filter to reduce the number of results.                | `groupsCount`, `groupsLimit`                                            |
| `ApplyActionFailed`                  | INVALID_ARGUMENT  | 400         | The action could not be applied to the ontology.                                                                                                                       |                                                                         |
| `AttachmentNotFound`                 | NOT_FOUND         | 404         | The requested attachment could not be found, or the client token does not have access to it.                                                                           | `attachmentRid`                                                         |
| `AttachmentSizeExceededLimit`        | INVALID_ARGUMENT  | 400         | The file is too large to be uploaded as an attachment. The maximum attachment size is 200 MB.                                                                          | `fileSizeBytes`, `fileLimitBytes`                                       |
| `CompositePrimaryKeyNotSupported`    | INVALID_ARGUMENT  | 400         | Primary keys consisting of multiple properties are not supported by this API. If you need support for this, please contact Palantir support.                           | `objectType`, `primaryKey`                                              |
| `DuplicateOrderBy`                   | INVALID_ARGUMENT  | 400         | The requested sort order includes duplicate properties.                                                                                                                | `properties`                                                            |
| `FunctionEncounteredUserFacingError` | INVALID_ARGUMENT  | 400         | The function failed to execute due to an error thrown by the function.                                                                                                 | `functionRid`, `functionVersion`, `message`                             |
| `FunctionInvalidInput`               | INVALID_ARGUMENT  | 400         | The function executed contains invalid input.                                                                                                                          | `functionRid`, `functionVersion`                                        |
| `FunctionExecutionTimedOut`          | INVALID_ARGUMENT  | 400         | The function failed to execute due to a timeout.                                                                                                                       | `functionRid`, `functionVersion`                                        |
| `InvalidContentLength`               | INVALID_ARGUMENT  | 400         | A `Content-Length` header is required for all uploads, but was missing or invalid.                                                                                     |                                                                         |
| `InvalidContentType`                 | INVALID_ARGUMENT  | 400         | The `Content-Type` cannot be inferred from the request content and `filename`. Please check your request content and `filename` to ensure they are compatible.         |                                                                         |
| `InvalidDurationGroupByValue`        | INVALID_ARGUMENT  | 400         | The given duration groupBy value is invalid. Units larger than day must have value `1` and date properties do not support filtering on units smaller than day.         |                                                                         |
| `InvalidDurationGroupByPropertyType` | INVALID_ARGUMENT  | 400         | The given property does not support duration group by operations.                                                                                                      | `property`, `objectType`, `propertyBaseType`                            |
| `InvalidFields`                      | INVALID_ARGUMENT  | 400         | The value of the given fields do not match the expected pattern. For example, an Ontology object property `id` should be written `properties.id`.                      | `properties`                                                            |
| `InvalidGroupId`                     | INVALID_ARGUMENT  | 400         | The provided value for a group id must be a UUID.                                                                                                                      | `groupId`                                                               |
| `InvalidParameterValue`              | INVALID_ARGUMENT  | 400         | The value of the given parameter is invalid.                                                                                                                           | `parameterId`, `parameterBaseType`, `parameterValue`                    |
| `InvalidPropertyFiltersCombination`  | INVALID_ARGUMENT  | 400         | The provided filters cannot be used together.                                                                                                                          | `property`, `propertyFilters`                                           |
| `InvalidPropertyType`                | INVALID_ARGUMENT  | 400         | The given property type is not of the expected type.                                                                                                                   | `property`, `propertyBaseType`                                          |
| `InvalidPropertyValue`               | INVALID_ARGUMENT  | 400         | The value of the given property is invalid.                                                                                                                            | `property`, `propertyBaseType`, `propertyValue`                         |
| `InvalidSortOrder`                   | INVALID_ARGUMENT  | 400         | At least one of sort orders in the order by parameter is invalid. Valid sort orders are 'asc' or 'desc'. Sort order can also be omitted, and defaults to 'asc'.        | `invalidSortOrder`                                                      |
| `InvalidSortType`                    | INVALID_ARGUMENT  | 400         | At least one of sort clauses in the order by parameter has an invalid type. Valid types are 'properties' or 'p'.                                                       | `invalidSortType`                                                       |
| `InvalidUserId`                      | INVALID_ARGUMENT  | 400         | The provided value for a user id must be a UUID.                                                                                                                       | `userId`                                                                |
| `LinkAlreadyExists`                  | CONFLICT          | 400         | The link the user is attempting to create already exists.                                                                                                              |                                                                         |
| `LinkedObjectNotFound`               | NOT_FOUND         | 404         | The requested linked object could not be found, or the client token does not have access to it.                                                                        | `linkType`, `linkedObjectType`, `linkedObjectPrimaryKey`                |
| `LinkTypeNotFound`                   | NOT_FOUND         | 404         | The requested link could not be found, or the client token does not have access to it.                                                                                 | `objectType`, `linkType`                                                |
| `MalformedPropertyFilters`           | INVALID_ARGUMENT  | 400         | At least one of requested filters is malformed.                                                                                                                        | `malformedPropertyFilter`                                               |
| `MultiplePropertyValuesNotSupported` | INVALID_ARGUMENT  | 400         | One of the requested property filters does not support multiple values. Please include only a single value for it.                                                     | `property`, `propertyFilters`                                           |
| `ObjectNotFound`                     | NOT_FOUND         | 404         | The requested object could not be found, or the client token does not have access to it.                                                                               | `objectType`, `primaryKey`                                              |
| `ObjectsExceededLimit`               | INVALID_ARGUMENT  | 400         | There are more objects, but they cannot be returned by this API. Only 10,000 objects are available for a given request.                                                |                                                                         |
| `ObjectTypeNotFound`                 | NOT_FOUND         | 404         | The requested object type could not be found, or the client token does not have access to it.                                                                          | `objectType`                                                            |
| `ObjectTypeNotSynced`                | CONFLICT          | 409         | The requested object type is not synced to the Ontology. Please re-index the object type in **Ontology manager**.                                                      | `objectType`                                                            |
| `OntologyEditsExceededLimit`         | INVALID_ARGUMENT  | 400         | The number of edits to the Ontology exceeded the allowed limit. This may happen if your Action is modifying too many objects.                                          | `editsCount`, `editsLimit`                                              |
| `OntologyNotFound`                   | NOT_FOUND         | 404         | The requested ontology could not be found, or the client token does not have access to it.                                                                             | `ontologyRid`                                                           |
| `OntologySyncing`                    | CONFLICT          | 409         | The requested object type has been changed in the **Ontology Manager** and changes are currently being applied. Wait a few seconds and try again.                      | `objectType`                                                            |
| `ParametersNotFound`                 | INVALID_ARGUMENT  | 400         | Some parameter IDs were not recognized by this action. See the `configuredParameterId` field for a list of valid parameter IDs.                                        | `actionType`, `unknownParameterIds`, `configuredParameterIds`           |
| `ParameterTypeNotSupported`          | INVALID_ARGUMENT  | 400         | This type of parameter is not currently supported by this API. If you need support for this, please reach out to Palantir Support.                                     | `parameterId`, `parameterBaseType`                                      |
| `PropertiesNotFound`                 | NOT_FOUND         | 404         | The requested properties could not be found on the object type.                                                                                                        | `objectType`, `properties`                                              |
| `PropertiesNotSearchable`            | INVALID_ARGUMENT  | 400         | Search is not enabled on the specified properties. Please mark the properties as *Searchable* in **Ontology manager**.                                                 | `properties`                                                            |
| `PropertiesNotSortable`              | INVALID_ARGUMENT  | 400         | Results could not be ordered by the requested properties. Please mark the properties as *Sortable* in **Ontology manager**.                                            | `properties`                                                            |
| `PropertyApiNameNotFound`            | INVALID_ARGUMENT  | 400         | A property that was required to have an API name, such as a primary key, is missing one. You can set an API name for it using the **Ontology Manager**.                | `propertyId`, `propertyBaseType`                                        |
| `PropertyBaseTypeNotSupported`       | INVALID_ARGUMENT  | 400         | This type of property is not currently supported by this API. If you need support for this, please reach out to Palantir Support.                                      | `objectType`, `property`, `propertyBaseType`                            |
| `PropertyFiltersNotSupported`        | INVALID_ARGUMENT  | 400         | One or more of the requested property filters are not supported.                                                                                                       | `property`, `propertyFilters`                                           |
| `QueryEncounteredUserFacingError`    | CONFLICT          | 409         | The authored `Query` failed to execute because of a user induced error. The message argument is meant to be displayed to the user.                                     | `functionRid`, `functionVersion`, `message`                             |
| `QueryRuntimeError`                  | INVALID_ARGUMENT  | 400         | The authored `Query` failed to execute because of a runtime error.                                                                                                     | `functionRid`, `functionVersion`, `message`, `stacktrace`, `parameters` |
| `QueryTimeExceededLimit`             | INVALID_ARGUMENT  | 400         | Time limits were exceeded for the `Query` execution.                                                                                                                   | `functionRid`, `functionVersion`                                        |
| `QueryMemoryExceededLimit`           | TIMEOUT           | 400         | Memory limits were exceeded for the `Query` execution.                                                                                                                 | `functionRid`, `functionVersion`                                        |
| `ViewObjectPermissionDenied`         | PERMISSION_DENIED | 403         | The provided token does not have permission to view any data sources backing this object type. Ensure the object type has backing data sources configured and visible. | `objectType`                                                            |


## Datasets errors

| Error name                          | Error code        | Status code | Description                                                                                                                   | Additional parameters                               |
|-------------------------------------|-------------------|-------------|-------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| `AbortTransactionPermissionDenied`  | PERMISSION_DENIED | 403         | The provided token does not have permission to abort the given transaction on the given dataset.                              | `datasetRid`, `transactionRid`                      |
| `BranchAlreadyExists`               | CONFLICT          | 409         | The branch cannot be created because a branch with that name already exists.                                                  | `datasetRid`, `branchId`                            |
| `BranchNotFound`                    | NOT_FOUND         | 404         | The requested branch could not be found, or the client token does not have access to it.                                      | `datasetRid`, `branchId`                            |
| `ColumnTypesNotSupported`           | INVALID_ARGUMENT  | 400         | The dataset contains column types that are not supported.                                                                     | `datasetRid`                                        |
| `CommitTransactionPermissionDenied` | PERMISSION_DENIED | 403         | The provided token does not have permission to commit the given transaction on the given dataset.                             | `datasetRid`, `transactionRid`                      |
| `CreateBranchPermissionDenied`      | PERMISSION_DENIED | 403         | The provided token does not have permission to create a branch of this dataset.                                               | `datasetRid`, `branchId`                            |
| `CreateDatasetPermissionDenied`     | PERMISSION_DENIED | 403         | The provided token does not have permission to create a dataset in this folder.                                               | `parentFolderRid`, `name`                           |
| `CreateTransactionPermissionDenied` | PERMISSION_DENIED | 403         | The provided token does not have permission to create a transaction on this dataset.                                          | `datasetRid`, `branchId`                            |
| `DatasetNotFound`                   | NOT_FOUND         | 404         | The requested dataset could not be found, or the client token does not have access to it.                                     | `datasetRid`                                        |
| `DeleteBranchPermissionDenied`      | PERMISSION_DENIED | 403         | The provided token does not have permission to delete the given branch from this dataset.                                     | `datasetRid`, `branchId`                            |
| `FileAlreadyExists`                 | NOT_FOUND         | 404         | The given file path already exists in the dataset and transaction.                                                            | `datasetRid`, `transactionRid`, `path`              |
| `FileNotFoundOnBranch`              | NOT_FOUND         | 404         | The requested file could not be found on the given branch, or the client token does not have access to it.                    | `datasetRid`, `branchId`, `path`                    |
| `FileNotFoundOnTransactionRange`    | NOT_FOUND         | 404         | The requested file could not be found on the given transaction range, or the client token does not have access to it.         | `datasetRid`, `endTransactionRid`, `path`           |
| `InvalidBranchId`                   | INVALID_ARGUMENT  | 400         | The requested branch name cannot be used. Branch names cannot be empty and must not look like RIDs or UUIDs.                  | `branchId`                                          |
| `InvalidTransactionType`            | INVALID_ARGUMENT  | 400         | The given transaction type is not valid. Valid transaction types are `SNAPSHOT`, `UPDATE`, `APPEND`, and `DELETE`.            | `datasetRid`, `transactionRid`, `transactionType`   |
| `OpenTransactionAlreadyExists`      | CONFLICT          | 409         | A transaction is already open on this dataset and branch. A branch of a dataset can only have one open transaction at a time. | `datasetRid`, `branchId`                            |
| `ReadTablePermissionDenied`         | PERMISSION_DENIED | 403         | The provided token does not have permission to read the given dataset as a table.                                             | `datasetRid`                                        |
| `SchemaNotFound`                    | NOT_FOUND         | 404         | A schema could not be found for the given dataset and branch, or the client token does not have access to it.                 | `datasetRid`, `branchId`                            |
| `TransactionNotCommitted`           | INVALID_ARGUMENT  | 400         | The given transaction has not been committed.                                                                                 | `datasetRid`, `transactionRid`, `transactionStatus` |
| `TransactionNotFound`               | NOT_FOUND         | 404         | The requested transaction could not be found on the dataset, or the client token does not have access to it.                  | `datasetRid`, `transactionRid`                      |
| `TransactionNotOpen`                | INVALID_ARGUMENT  | 400         | The given transaction is not open.                                                                                            | `datasetRid`, `transactionRid`, `transactionStatus` |
| `UploadFilePermissionDenied`        | PERMISSION_DENIED | 403         | The provided token does not have permission to upload the given file to the given dataset and transaction.                    | `datasetRid`, `transactionRid`, `path`              |


## Filesystems errors

| Error name                                  | Error code        | Status code | Description                                                                               | Additional parameters             |
|---------------------------------------------|-------------------|-------------|-------------------------------------------------------------------------------------------|-----------------------------------|
| `FolderNotFound`                            | NOT_FOUND         | 404         | The requested folder could not be found, or the client token does not have access to it.  | `folderRid`                       |
| `ResourceNameAlreadyExists`                 | CONFLICT          | 409         | The provided resource name is already in use by another resource in the same folder.      | `resourceName`, `parentFolderRid` |


## Operation errors

| Error name                  | Error code        | Status code | Description                                                            | Additional parameters |
|-----------------------------|-------------------|-------------|------------------------------------------------------------------------|-----------------------|
| `OperationNotFound`         | NOT_FOUND         | 404         | The operation is not found, or the user does not have access to it.    |  `id`                 |                    


## General errors

In addition to the above endpoint-specific errors, all Foundry APIs can return the following more general errors.

| Error name                     | Error code        | Status code | Description                                                                                                                                                               |
|--------------------------------|-------------------|-------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `ApiFeaturePreviewUsageOnly`   | INVALID_ARGUMENT  | 400         | The given API endpoint is not for production use and is only supported in preview mode. Please add a `preview=true` query parameter to call this endpoint.                |
| `ApiUsageDenied`               | PERMISSION_DENIED | 403         | The user/token provided is not authorized for the API endpoint.                                                                                                           |
| `Conjure:InvalidArgument`      | INVALID_ARGUMENT  | 400         | One or more of the request's arguments is invalid.                                                                                                                        |
| `Conjure:UnprocessableEntity`  | INVALID_ARGUMENT  | 422         | One or more of the request's arguments is invalid.                                                                                                                        |
| `Conjure:UnsupportedMediaType` | INVALID_ARGUMENT  | 415         | The `Content-type` header for the request is invalid. Use `Content-type: application/json`.                                                                               |
| `Default:Internal`             | INTERNAL          | 500         | An error occurred within the service. Retry your request and [file a support ticket](/docs/foundry/getting-started/file-support-ticket) for help if the problem persists. |
| `Default:InvalidArgument`      | INVALID_ARGUMENT  | 400         | One or more of the request's arguments is invalid.                                                                                                                        |
| `Default:PermissionDenied`     | PERMISSION_DENIED | 403         | You are missing permission to access information necessary to complete your request.                                                                                      |
| `Default:Unauthorized`         | UNAUTHORIZED      | 401         | The given authorization token header is invalid.                                                                                                                          |
| `InvalidPageSize`              | INVALID_ARGUMENT  | 400         | The provided page size was zero or negative. Page sizes must be greater than zero.                                                                                        |
| `InvalidPageToken`             | INVALID_ARGUMENT  | 400         | The provided page token could not be used to retrieve the next page of results.                                                                                           |
| `InvalidParameterCombination`  | INVALID_ARGUMENT  | 400         | The given parameters are individually valid but cannot be used in the given combination.                                                                                  |
| `MissingCredentials`           | UNAUTHORIZED      | 401         | The endpoint requires an authorization token to be passed as a header, but none was found.                                                                                |


## Status codes

Some errors do not include an error name or other response body. In that case, check the status code of the error.

| Status code | Description                                                                                                                          |
|-------------|--------------------------------------------------------------------------------------------------------------------------------------|
| 404         | The endpoint you are requesting does not exist. Check your request URL.                                                              |
| 414         | Your URL is too long. Remove query parameters or look at the endpoint's documentation for alternatives.                              |
| 429         | The service is experiencing too many requests. Retry your request shortly and reduce your request rate.                              |
| 431         | Your URL or HTTP headers are too long. Remove headers or query parameters, or look at the endpoint's documentation for alternatives. |
| 503         | The service is unavailable. Retry your request later.                                                                                |

:::callout{theme=neutral title=Note}
In exceptional circumstances, the service may return other, undocumented errors. Note that all errors returned by this API are compliant and consistent with [HTTP status code semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-status-codes). Please [file a support ticket](/docs/foundry/getting-started/file-support-ticket) for help resolving these errors.
:::
