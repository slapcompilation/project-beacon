<!-- source: https://palantir.com/docs/foundry/action-types/parameter-performance-considerations/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Performance considerations for parameter configuration

Dependencies between parameters, such as in the definitions of [default values](/docs/foundry/action-types/parameters-default-value/) and [multiple-choice options](/docs/foundry/action-types/parameters-filter/), can impact the time that it takes for an action form to load. For example, consider the following action parameter configuration:

1. The first parameter is an `object reference` with a `from single result of object set` default value.
2. The second parameter is a string with a default value that is an `object parameter property` referencing the first parameter.
3. The third parameter is also a string, with no default value, but configured as a `multiple choice` dropdown using `get options from an object set`. The object set definition references the second parameter.

When a user loads an action form for this action, multiple operations need to be performed iteratively.

1. First, the default value for the first parameter needs to be retrieved.
2. Then, the second parameter's default value needs to be derived from the first parameter value.
3. Finally, the options for the third parameter need to be derived from the second parameter value.

When configuring action parameters, it is recommended to keep the dependency hierarchy as flat as possible. In the context of the action described above, referencing the first parameter instead of the second parameter in the third parameter's object set definition would allow the necessary information for the second and third parameter to be derived in parallel, reducing the total latency between opening the form and the form being fully interactive.
