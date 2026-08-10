<!-- source: https://palantir.com/docs/foundry/sap/sap-cockpit/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Palantir Foundry Connector 2.0 for SAP Applications Cockpit

The Palantir Foundry Connector 2.0 for SAP Applications ("Connector") **Cockpit** is an interface to administer the Connector parameters. It can be reached from the SAP GUI by an SAP user, using the `/n/PALANTIR/COCKPIT` transaction code.

## Administration

This tab provides access to the main tools used to administer the Connector.

### Maintain configuration table

Core Connector parameters are maintained in this configuration table. These parameters control the Connector behavior.

The parameters are explained in the documentation on [performance parameters](/docs/foundry/sap/install-sap-connector/#performance-parameters), on [how to configure the Remote Agent and register the Connector](/docs/foundry/sap/install-sap-remote-agent/#configure-remote-agent-and-registering-the-connector), and on [parameters used to address known SAP issues](/docs/foundry/sap/configure-sap-slt/#parameters-used-to-address-known-sap-issues).

### Set default configuration parameters

Default parameters can be maintained in the Connector's parameters table. These parameters act as system defaults unless overridden elsewhere.

| Parameter ID | Parameter Name | Parameter Name |
| --- | --- | --- |
| SYSTEM\_THRESHOLD | CPU\_LOAD | 95 |
| SYSTEM\_THRESHOLD | MEMORY\_FREE | 11 |
| PAGE | PAGESIZE | 50000 |
| SLT | PAGESIZE | 52437000 |
| SLT | FETCH\_OPTION | XML |
| SLT | DEBUG\_MODE | OFF |

### User authorization check

This tool checks whether the user has all the necessary authorizations defined in the `/PALANTIR/SERVICE_USER` role.

## Data transfer monitor

This tab contains settings used to control how data transfer is logged by the Connector.

### Adjust log tables

This option will adjust log tables to schedule a job to clear logs. This option is useful when upgrading from version v1.4.0 or earlier. New fields were added to database tables; this will populate the new fields from existing records. If you started running Foundry syncs with version 1.4.0 or after, there is no need to use this option.

### Foundry sync log report

This option reports log headers, log item and page information for all Foundry syncs.

## Clear logs

This tab contains settings used to control log retention.

### Schedule Job

This options schedules a job to clear log tables. Parameters are as follows:

* **Recovery:** Indicates how many hours later the scheduled job will restart. In other words, it is the frequency of the scheduled job in hours. Default: `24` (meaning the job will run daily).
* **Data with low relevance:** Indicates how many days item data (low relevance) is held before it is deleted. Item data includes the message of log items, page item table, and item data of incremental table information. Default: `31` (meaning item data will be deleted after 1 month).
* **Data with high relevance:** Indicates how many days header data (high relevance) is held before it is deleted. Default: `365` (meaning header data will be deleted after 1 year). For incremental updates, this parameter should be at least 31.
* **Only if transferred to Foundry:** Indicates that when item data is deleted, only data transferred to Foundry is deleted. If this parameter is enabled, all data which cannot be transferred to Foundry yet will also be deleted. Default: Enabled.

For more details, see [Set up and configure housekeeping](/docs/foundry/sap/housekeeping/)

## Sensitive data

This tab gives access to settings that control how to handle sensitive data.

### Encryption and data masking configurations

Data masking and encryption can be maintained from the **Data Masking** tab.

Configuration is set on the Object Type, Object and Field level, using the following parameters:

* **Object Type:** Object type of the source object. Possible entries are:
  * TABLE
  * BEX
  * EXTRACTOR
  * FUNCTION
  * INFOPROVIDER
  * SLT
* **Object:** Object name. (**SFLIGHT** was used in the example above.)
* **Field:** Field to be masked/encrypted after reading. New rows need to be created for each field in the output.
* **Masking Pattern Engine:** Engine to be used during pattern matching. Regular expressions are supported.
* **Pattern:** Pattern to be used for pattern matching. Leaving blank will match the entire field value by default.
* **Mask Character:** Mask value to be replaced after pattern matching. Possible entries are:
  * Clear Matched Characters – Replace pattern with blank space.
  * '\* : Replace pattern with \* character. Each character will be replaced with a star symbol.
  * '# : Replace pattern with # character. Each character will be replaced with a hash symbol.
* **Encryption Algorithm:** Algorithm to be used during encryption. The supported algorithm is AES12CBC.
* **Hashing Algorithm:** Algorithm to be used during hashing. Supported algorithms are:
  * MD5
  * SHA1
  * SHA256
* **Masked Column Display:** Display/hide masked column. Options are:
  * Display in the same column: Masked column will be displayed under the original column name. Masking attributes needs to be filled in.
  * Display in a new column: Masked column will be displayed in COL\_NAME\_MASKED column.
  * Hide Column: Masked column won't be displayed.
* **Encrypted Column Display:** Display/hide encrypted column. Options are:
  * Display in the same column: Encrypted column will be displayed under the original column name. Encryption attributes need to be filled in.
  * Display in a new column: Encrypted column will be displayed in COL\_NAME\_ENC column.
  * Hide Column: Encrypted column won't be displayed.
* **Hashed Column Display:** Display/hide hashed column. Options are:
  * Display in the same column: Hashed column will be displayed under the original column name. Hashing attributes needs to be filled in.
  * Display in a new column: Hashed column will be displayed in COL\_NAME\_HASH column.
  * Hide Column: Hashed column won't be displayed.

Once configuration has been completed, users can return to the SAP Cockpit Screen.

## Prefilters

Global filters (prefilters) are used to control sensitive data extracted from SAP systems. SAP administrators can specify predefined filters and these filters are added to the ones requested from Foundry. Even if these filter values are not specified in the sync definition in Foundry, they will be automatically added to the request.

To specify filters, use the same syntax used in a Foundry sync definition. [Learn more about the sync syntax](/docs/foundry/available-connectors/sap-custom-source/#filter).
