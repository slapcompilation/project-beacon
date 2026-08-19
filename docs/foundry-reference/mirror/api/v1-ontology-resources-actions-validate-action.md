<!-- source: https://palantir.com/docs/foundry/api/v1/ontology-resources/actions/validate-action/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Validate Action

`POST /api/v1/ontologies/{ontologyRid}/actions/{actionType}/validate`

Validates if an action can be run with the given set of parameters.
The response contains the evaluation of parameters and **submission criteria**
that determine if the request is `VALID` or `INVALID`.
For performance reasons, validations will not consider existing objects or other data in Foundry.
For example, the uniqueness of a primary key or the existence of a user ID will not be checked.
Note that [parameter default values](/docs/foundry/action-types/parameters-default-value/) are not currently supported by
this endpoint. Unspecified parameters will be given a default value of `null`.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:ontologies-read`.

Scopes: `api:ontologies-read`

## Path parameters

- `ontologyRid` · string · required
  "The unique Resource Identifier (RID) of the Ontology that contains the action. To look up your Ontology RID, please use the **List ontologies** endpoint or check the **Ontology Manager**."
- `actionType` · string · required
  "The API name of the action to validate. To find the API name for your action, use the **List action types** endpoint or check the **Ontology Manager**."

## Request

- `ValidateActionRequest` · object · required
  - `parameters` · map
    - `ParameterId` · string · required
      "The unique identifier of the parameter. Parameters are used as inputs when an action or query is applied. Parameters can be viewed and managed in the **Ontology Manager**."
    - `DataValue` · any · required
      "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                                | JSON encoding                                         | Example                                                                                                                                                       | |-------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------| | Array                               | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Attachment                          | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`                                                                                       | | Boolean                             | boolean                                               | `true`                                                                                                                                                        | | Byte                                | number                                                | `31`                                                                                                                                                          | | CipherText                          | string                                                | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"` | | Date                                | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                                                                                                | | Decimal                             | string                                                | `"2.718281828"`                                                                                                                                               | | Double                              | number                                                | `3.14159265`                                                                                                                                                  | | EntrySet                            | array of JSON objects                                 | `[{"key": "EMP1234", "value": "true"}, {"key": "EMP4444", "value": "false"}]`                                                                                 | | Float                               | number                                                | `3.14159265`                                                                                                                                                  | | Integer                             | number                                                | `238940`                                                                                                                                                      | | Long                                | string                                                | `"58319870951433"`                                                                                                                                            | | Marking                             | string                                                | `"MU"`                                                                                                                                                        | | Null                                | null                                                  | `null`                                                                                                                                                        | | Object Set                          | string OR the object set definition                   | `ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`                                                                                | | Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`                                                                                                                                     | | Ontology Interface Object Reference | JSON encoding of the object's API name and primary key| `{"objectTypeApiName":"Employee", "primaryKeyValue":"EMP1234"}`                                                                                               | | Ontology Object Type Reference      | string of the object type's api name                  | `"Employee"`                                                                                                                                                  | | Scenario Reference                  | string of the scenario RID                            | `"ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48"`                                                                                                 | | Set                                 | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Short                               | number                                                | `8739`                                                                                                                                                        | | String                              | string                                                | `"Call me Ishmael"`                                                                                                                                           | | Struct                              | JSON object                                           | `{"name": "John Doe", "age": 42}`                                                                                                                             | | TwoDimensionalAggregation           | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}`                                                                                 | | ThreeDimensionalAggregation         | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`                                                                                | | Timestamp                           | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                                                                                                      |"

## Response

- `ValidateActionResponse` · object · required
  "Success response."
  - `result` · enum · required
    one of `VALID`, `INVALID`
    "Represents the state of a validation."
  - `submissionCriteria` · list
    - `SubmissionCriteriaEvaluation` · object · required
      "Contains the status of the **submission criteria**. **Submission criteria** are the prerequisites that need to be satisfied before an Action can be applied. These are configured in the **Ontology Manager**."
      - `configuredFailureMessage` · string
        "The message indicating one of the **submission criteria** was not satisfied. This is configured per **submission criteria** in the **Ontology Manager**."
      - `result` · enum · required
        one of `VALID`, `INVALID`
        "Represents the state of a validation."
  - `parameters` · map
    - `ParameterId` · string · required
      "The unique identifier of the parameter. Parameters are used as inputs when an action or query is applied. Parameters can be viewed and managed in the **Ontology Manager**."
    - `ParameterEvaluationResult` · object · required
      "Represents the validity of a parameter against the configured constraints."
      - `result` · enum · required
        one of `VALID`, `INVALID`
        "Represents the state of a validation."
      - `evaluatedConstraints` · list
        - `ParameterEvaluatedConstraint` · union · required
          "A constraint that an action parameter value must satisfy in order to be considered valid. Constraints can be configured on action parameters in the **Ontology Manager**. Applicable constraints are determined dynamically based on parameter inputs. Parameter values are evaluated against the final set of constraints. The type of the constraint. | Type                  | Description                                                                                                                                                                                                                     | |-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| | `arraySize`           | The parameter expects an array of values and the size of the array must fall within the defined range.                                                                                                                          | | `groupMember`         | The parameter value must be the user id of a member belonging to at least one of the groups defined by the constraint.                                                                                                          | | `objectPropertyValue` | The parameter value must be a property value of an object found within an object set.                                                                                                                                           | | `objectQueryResult`   | The parameter value must be the primary key of an object found within an object set.                                                                                                                                            | | `oneOf`               | The parameter has a manually predefined set of options.                                                                                                                                                                         | | `range`               | The parameter value must be within the defined range.                                                                                                                                                                           | | `stringLength`        | The parameter value must have a length within the defined range.                                                                                                                                                                | | `stringRegexMatch`    | The parameter value must match a predefined regular expression.                                                                                                                                                                 | | `unevaluable`         | The parameter cannot be evaluated because it depends on another parameter or object set that can't be evaluated. This can happen when a parameter's allowed values are defined by another parameter that is missing or invalid. |"
          - `struct` · object
            "Represents the validity of a singleton struct parameter."
            - `structFields` · map
              - `StructParameterFieldApiName` · string · required
                "The unique identifier of the struct parameter field."
              - `StructFieldEvaluationResult` · object · required
                "Represents the validity of a struct parameter's fields against the configured constraints."
                - `result` · enum · required
                  one of `VALID`, `INVALID`
                  "Represents the state of a validation."
                - `evaluatedConstraints` · list
                  - `StructFieldEvaluatedConstraint` · union · required
                    "A constraint that an action struct parameter field value must satisfy in order to be considered valid. Constraints can be configured on fields of struct parameters in the **Ontology Manager**. Applicable constraints are determined dynamically based on parameter inputs. Parameter values are evaluated against the final set of constraints. The type of the constraint. | Type                  | Description                                                                                                                                                                                                                     | |-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| | `oneOf`               | The struct parameter field has a manually predefined set of options.                                                                                                                                                            | | `range`               | The struct parameter field value must be within the defined range.                                                                                                                                                              | | `stringLength`        | The struct parameter field value must have a length within the defined range.                                                                                                                                                   | | `stringRegexMatch`    | The struct parameter field value must match a predefined regular expression.                                                                                                                                                    | | `objectQueryResult`   | The struct parameter field value must be the primary key of an object found within an object set.                                                                                                                               |"
                    - `oneOf` · object
                      "The parameter has a manually predefined set of options."
                      - `options` · list
                        - `ParameterOption` · object · required
                          "A possible value for the parameter. This is defined in the **Ontology Manager** by Actions admins."
                          - `displayName` · string
                            "The display name of the entity."
                          - `value` · any
                            "An allowed configured value for a parameter within an action."
                      - `otherValuesAllowed` · boolean · required
                        "A flag denoting whether custom, user provided values will be considered valid. This is configured via the **Allowed "Other" value** toggle in the **Ontology Manager**."
                    - `range` · object
                      "The parameter value must be within the defined range."
                      - `lt` · any
                        "Less than"
                      - `lte` · any
                        "Less than or equal"
                      - `gt` · any
                        "Greater than"
                      - `gte` · any
                        "Greater than or equal"
                    - `objectQueryResult` · object
                      "The parameter value must be the primary key of an object found within an object set."
                    - `stringLength` · object
                      "The parameter value must have a length within the defined range. *This range is always inclusive.*"
                      - `lt` · any
                        "Less than"
                      - `lte` · any
                        "Less than or equal"
                      - `gt` · any
                        "Greater than"
                      - `gte` · any
                        "Greater than or equal"
                    - `stringRegexMatch` · object
                      "The parameter value must match a predefined regular expression."
                      - `regex` · string · required
                        "The regular expression configured in the **Ontology Manager**."
                      - `configuredFailureMessage` · string
                        "The message indicating that the regular expression was not matched. This is configured per parameter in the **Ontology Manager**."
                - `required` · boolean · required
                  "Represents whether the parameter is a required input to the action."
          - `oneOf` · object
            "The parameter has a manually predefined set of options."
            - `options` · list
              - `ParameterOption` · object · required
                "A possible value for the parameter. This is defined in the **Ontology Manager** by Actions admins."
                - `displayName` · string
                  "The display name of the entity."
                - `value` · any
                  "An allowed configured value for a parameter within an action."
            - `otherValuesAllowed` · boolean · required
              "A flag denoting whether custom, user provided values will be considered valid. This is configured via the **Allowed "Other" value** toggle in the **Ontology Manager**."
          - `array` · object
            "Evaluated constraints of array parameters that support per-entry constraint evaluations."
            - `entries` · list
              - `ArrayEntryEvaluatedConstraint` · union · required
                "Evaluated constraints for entries of array parameters for which per-entry evaluation is supported."
                - `struct` · object
                  "Represents the validity of a singleton struct parameter."
                  - `structFields` · map
                    - `StructParameterFieldApiName` · string · required
                      "The unique identifier of the struct parameter field."
                    - `StructFieldEvaluationResult` · object · required
                      "Represents the validity of a struct parameter's fields against the configured constraints."
                      - `result` · enum · required
                        one of `VALID`, `INVALID`
                        "Represents the state of a validation."
                      - `evaluatedConstraints` · list
                        - `StructFieldEvaluatedConstraint` · union · required
                          "A constraint that an action struct parameter field value must satisfy in order to be considered valid. Constraints can be configured on fields of struct parameters in the **Ontology Manager**. Applicable constraints are determined dynamically based on parameter inputs. Parameter values are evaluated against the final set of constraints. The type of the constraint. | Type                  | Description                                                                                                                                                                                                                     | |-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| | `oneOf`               | The struct parameter field has a manually predefined set of options.                                                                                                                                                            | | `range`               | The struct parameter field value must be within the defined range.                                                                                                                                                              | | `stringLength`        | The struct parameter field value must have a length within the defined range.                                                                                                                                                   | | `stringRegexMatch`    | The struct parameter field value must match a predefined regular expression.                                                                                                                                                    | | `objectQueryResult`   | The struct parameter field value must be the primary key of an object found within an object set.                                                                                                                               |"
                          - `oneOf` · object
                            "The parameter has a manually predefined set of options."
                            - `options` · list
                              - `ParameterOption` · object · required
                                "A possible value for the parameter. This is defined in the **Ontology Manager** by Actions admins."
                                - `displayName` · string
                                  "The display name of the entity."
                                - `value` · any
                                  "An allowed configured value for a parameter within an action."
                            - `otherValuesAllowed` · boolean · required
                              "A flag denoting whether custom, user provided values will be considered valid. This is configured via the **Allowed "Other" value** toggle in the **Ontology Manager**."
                          - `range` · object
                            "The parameter value must be within the defined range."
                            - `lt` · any
                              "Less than"
                            - `lte` · any
                              "Less than or equal"
                            - `gt` · any
                              "Greater than"
                            - `gte` · any
                              "Greater than or equal"
                          - `objectQueryResult` · object
                            "The parameter value must be the primary key of an object found within an object set."
                          - `stringLength` · object
                            "The parameter value must have a length within the defined range. *This range is always inclusive.*"
                            - `lt` · any
                              "Less than"
                            - `lte` · any
                              "Less than or equal"
                            - `gt` · any
                              "Greater than"
                            - `gte` · any
                              "Greater than or equal"
                          - `stringRegexMatch` · object
                            "The parameter value must match a predefined regular expression."
                            - `regex` · string · required
                              "The regular expression configured in the **Ontology Manager**."
                            - `configuredFailureMessage` · string
                              "The message indicating that the regular expression was not matched. This is configured per parameter in the **Ontology Manager**."
                      - `required` · boolean · required
                        "Represents whether the parameter is a required input to the action."
          - `groupMember` · object
            "The parameter value must be the user id of a member belonging to at least one of the groups defined by the constraint."
          - `objectPropertyValue` · object
            "The parameter value must be a property value of an object found within an object set."
          - `range` · object
            "The parameter value must be within the defined range."
            - `lt` · any
              "Less than"
            - `lte` · any
              "Less than or equal"
            - `gt` · any
              "Greater than"
            - `gte` · any
              "Greater than or equal"
          - `arraySize` · object
            "The parameter expects an array of values and the size of the array must fall within the defined range."
            - `lt` · any
              "Less than"
            - `lte` · any
              "Less than or equal"
            - `gt` · any
              "Greater than"
            - `gte` · any
              "Greater than or equal"
          - `objectQueryResult` · object
            "The parameter value must be the primary key of an object found within an object set."
          - `stringLength` · object
            "The parameter value must have a length within the defined range. *This range is always inclusive.*"
            - `lt` · any
              "Less than"
            - `lte` · any
              "Less than or equal"
            - `gt` · any
              "Greater than"
            - `gte` · any
              "Greater than or equal"
          - `stringRegexMatch` · object
            "The parameter value must match a predefined regular expression."
            - `regex` · string · required
              "The regular expression configured in the **Ontology Manager**."
            - `configuredFailureMessage` · string
              "The message indicating that the regular expression was not matched. This is configured per parameter in the **Ontology Manager**."
          - `unevaluable` · object
            "The parameter cannot be evaluated because it depends on another parameter or object set that can't be evaluated. This can happen when a parameter's allowed values are defined by another parameter that is missing or invalid."
      - `required` · boolean · required
        "Represents whether the parameter is a required input to the action."
      - `defaultValue` · any
        "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                                | JSON encoding                                         | Example                                                                                                                                                       | |-------------------------------------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------| | Array                               | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Attachment                          | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`                                                                                       | | Boolean                             | boolean                                               | `true`                                                                                                                                                        | | Byte                                | number                                                | `31`                                                                                                                                                          | | CipherText                          | string                                                | `"CIPHER::ri.bellaso.main.cipher-channel.e414ab9e-b606-499a-a0e1-844fa296ba7e::unzjs3VifsTxuIpf1fH1CJ7OaPBr2bzMMdozPaZJtCii8vVG60yXIEmzoOJaEl9mfFFe::CIPHER"` | | Date                                | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                                                                                                | | Decimal                             | string                                                | `"2.718281828"`                                                                                                                                               | | Double                              | number                                                | `3.14159265`                                                                                                                                                  | | EntrySet                            | array of JSON objects                                 | `[{"key": "EMP1234", "value": "true"}, {"key": "EMP4444", "value": "false"}]`                                                                                 | | Float                               | number                                                | `3.14159265`                                                                                                                                                  | | Integer                             | number                                                | `238940`                                                                                                                                                      | | Long                                | string                                                | `"58319870951433"`                                                                                                                                            | | Marking                             | string                                                | `"MU"`                                                                                                                                                        | | Null                                | null                                                  | `null`                                                                                                                                                        | | Object Set                          | string OR the object set definition                   | `ri.object-set.main.versioned-object-set.h13274m8-23f5-431c-8aee-a4554157c57z`                                                                                | | Ontology Object Reference           | JSON encoding of the object's primary key             | `10033123` or `"EMP1234"`                                                                                                                                     | | Ontology Interface Object Reference | JSON encoding of the object's API name and primary key| `{"objectTypeApiName":"Employee", "primaryKeyValue":"EMP1234"}`                                                                                               | | Ontology Object Type Reference      | string of the object type's api name                  | `"Employee"`                                                                                                                                                  | | Scenario Reference                  | string of the scenario RID                            | `"ri.actions..scenario.cf2a8a49-8b56-446d-ab04-a6bc7fadef48"`                                                                                                 | | Set                                 | array                                                 | `["alpha", "bravo", "charlie"]`                                                                                                                               | | Short                               | number                                                | `8739`                                                                                                                                                        | | String                              | string                                                | `"Call me Ishmael"`                                                                                                                                           | | Struct                              | JSON object                                           | `{"name": "John Doe", "age": 42}`                                                                                                                             | | TwoDimensionalAggregation           | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}`                                                                                 | | ThreeDimensionalAggregation         | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`                                                                                | | Timestamp                           | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                                                                                                      |"
