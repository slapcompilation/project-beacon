<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/model-versions/list-model-versions/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Model Versions

`GET /api/v2/models/{modelRid}/versions`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Lists all Model Versions for a given Model.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Path parameters

- `modelRid` · string · required
  "The Resource Identifier (RID) of a Model."

## Query parameters

- `branch` · string
  "The branch to list versions from. Defaults to master on most enrollments."
- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ListModelVersionsResponse` · object · required
  - `data` · list
    - `ModelVersion` · object · required
      - `rid` · string · required
        "The Resource Identifier (RID) of a Model Version."
      - `modelApi` · object · required
        "The Model API is a specification that describes the inputs and outputs of a machine learning model. It is used to define the interface for the model, including the types of data that can be passed to it and the types of data that it will return."
        - `inputs` · list
          - `ModelApiInput` · union · required
            - `unsupported` · object
              - `unsupportedType` · string · required
              - `params` · map
                - `UnsupportedTypeParamKey` · string · required
                - `UnsupportedTypeParamValue` · string · required
            - `parameter` · object
              - `name` · string · required
              - `required` · boolean
                "true by default; false if the input or output can be null or omitted"
              - `dataType` · union · required
                - `date` · object
                - `boolean` · object
                - `unsupported` · object
                  - `unsupportedType` · string · required
                  - `params` · map
                    - `UnsupportedTypeParamKey` · string · required
                    - `UnsupportedTypeParamValue` · string · required
                - `string` · object
                - `array` · object
                  - `itemType` · union · required
                - `double` · object
                - `integer` · object
                - `float` · object
                - `any` · object
                - `map` · object
                  - `keyType` · union · required
                  - `valueType` · union · required
                - `long` · object
                - `timestamp` · object
            - `tabular` · object
              - `name` · string · required
              - `required` · boolean
                "true by default; false if the input or output can be null or omitted"
              - `columns` · list
                - `ModelApiColumn` · object · required
                  - `name` · string · required
                  - `required` · boolean
                    "true by default; false if the column can be null or omitted"
                  - `dataType` · union · required
                    - `date` · object
                    - `boolean` · object
                    - `unsupported` · object
                      - `unsupportedType` · string · required
                      - `params` · map
                        - `UnsupportedTypeParamKey` · string · required
                        - `UnsupportedTypeParamValue` · string · required
                    - `string` · object
                    - `array` · object
                      - `itemType` · union · required
                    - `double` · object
                    - `integer` · object
                    - `float` · object
                    - `any` · object
                    - `map` · object
                      - `keyType` · union · required
                      - `valueType` · union · required
                    - `long` · object
                    - `timestamp` · object
              - `format` · enum
                one of `PANDAS`, `SPARK`
                "Dataframe format the model will receive or is expected to return for this input or output. PANDAS is the default."
        - `outputs` · list
          - `ModelApiOutput` · union · required
            - `unsupported` · object
              - `unsupportedType` · string · required
              - `params` · map
                - `UnsupportedTypeParamKey` · string · required
                - `UnsupportedTypeParamValue` · string · required
            - `parameter` · object
              - `name` · string · required
              - `required` · boolean
                "true by default; false if the input or output can be null or omitted"
              - `dataType` · union · required
                - `date` · object
                - `boolean` · object
                - `unsupported` · object
                  - `unsupportedType` · string · required
                  - `params` · map
                    - `UnsupportedTypeParamKey` · string · required
                    - `UnsupportedTypeParamValue` · string · required
                - `string` · object
                - `array` · object
                  - `itemType` · union · required
                - `double` · object
                - `integer` · object
                - `float` · object
                - `any` · object
                - `map` · object
                  - `keyType` · union · required
                  - `valueType` · union · required
                - `long` · object
                - `timestamp` · object
            - `tabular` · object
              - `name` · string · required
              - `required` · boolean
                "true by default; false if the input or output can be null or omitted"
              - `columns` · list
                - `ModelApiColumn` · object · required
                  - `name` · string · required
                  - `required` · boolean
                    "true by default; false if the column can be null or omitted"
                  - `dataType` · union · required
                    - `date` · object
                    - `boolean` · object
                    - `unsupported` · object
                      - `unsupportedType` · string · required
                      - `params` · map
                        - `UnsupportedTypeParamKey` · string · required
                        - `UnsupportedTypeParamValue` · string · required
                    - `string` · object
                    - `array` · object
                      - `itemType` · union · required
                    - `double` · object
                    - `integer` · object
                    - `float` · object
                    - `any` · object
                    - `map` · object
                      - `keyType` · union · required
                      - `valueType` · union · required
                    - `long` · object
                    - `timestamp` · object
              - `format` · enum
                one of `PANDAS`, `SPARK`
                "Dataframe format the model will receive or is expected to return for this input or output. PANDAS is the default."
      - `condaRequirements` · list
      - `backingRepositories` · list
      - `createdTime` · string · required
        "The time at which the resource was created."
      - `source` · union
        "The source from which this model version was created."
        - `importedContainerizedModel` · object
          "Model version imported from a containerized model."
        - `external` · object
          "Model version backed by an external model."
        - `codeWorkspace` · object
          "Model version created from a code workspace."
          - `codeWorkspaceRid` · string · required
          - `branch` · string · required
        - `modelStudio` · object
          "Model version created from Model Studio."
          - `modelStudioRid` · string · required
        - `codeRepository` · object
          "Model version created from a code repository."
          - `repositoryRid` · string · required
          - `branch` · string · required
        - `sdk` · object
          "Model version created via the SDK."
        - `promoted` · object
          "Model version promoted from another model version."
          - `previousModelRid` · string · required
            "The Resource Identifier (RID) of a Model."
          - `previousModelVersionRid` · string · required
            "The Resource Identifier (RID) of a Model Version."
      - `linkedExperiment` · string
        "The Experiment linked to this Model Version, if one exists."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `UnsupportedModelSource` (INVALID_ARGUMENT) — "The Model Version has a source type that is not supported by the API. This can occur when the model was created through a legacy or internal workflow that is not exposed through the public API."
- `ModelNotFound` (NOT_FOUND) — "The given Model could not be found."
