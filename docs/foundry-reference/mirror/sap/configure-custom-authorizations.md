<!-- source: https://palantir.com/docs/foundry/sap/configure-custom-authorizations/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Configure custom authorization and role management

The Palantir Foundry Connector 2.0 for SAP Applications supports custom authorization management from SP16 onwards. Roles and object access definitions can be defined on transparent tables instead of SAP Standard Authorization Management (`PFCG`).

To enable this feature, run the `/PALANTIR/PARAM` transaction and maintain the following parameter values:

* **Param ID:** `SYSTEM`
* **Param Name:** `AUTH_CHECK_SOURCE`
* **Param Value:** `TABLE`

If this feature is enabled, existing content roles will not be checked. To deactivate this feature, delete the parameter or change the parameter value from `TABLE` to `PFCG`.

To create custom roles, follow the steps below:

* Run the `/PALANTIR/AUTH_01` transaction to define new roles.
  * Role ID is the unique identifier for the role. It can be used across all contexts.

  * Object Type is the object type supported by the Foundry SAP Connector:
    * `TABLE`
    * `REMOTETABLE`
    * `INFOPROVIDER`
    * `REMOTEINFOPROVIDER`
    * `BEX`
    * `FUNCTION`
    * `REMOTEFUNCTION`
    * `SLT`
    * `EXTRACTOR`

  * Object is the main extraction object. For example, if the object type is `TABLE` then the object should be the table name (`BSEG` or `B*`; wildcards are supported).

  * Configure the `Exc/Inc` setting to allow or deny access. Use `Exclude` to deny access to objects.

* Run the `/PALANTIR/AUTH_02` transaction and assign roles to users and contexts.
  * The user is the one used by Foundry to connect to SAP, defined in the Foundry Source configuration.
  * If there is no remote agent, extractor, or SLT, then context should be left blank.
  * The same role can be used for multiple contexts and users.
