<!-- source: https://palantir.com/docs/foundry/sap/backup-restore/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Back up and restore the Palantir Foundry Connector 2.0 for SAP Applications

The certification for the Palantir Foundry Connector 2.0 for SAP Applications guarantees that it can be backed up and restored in case of system migrations or uninstallations. The following sections explain how to back up and restore the Connector when required.

## Prerequisites

* Palantir Foundry Connector 2.0 for SAP Applications SP13 or above

## Back up important tables

To back up the tables to a .zip file and download to a filesystem for later use, run the `/n/palantir/backup` transaction code. This will back up all Connector tables and their content.

The following tables are included in the Connector backup

* `/PALANTIR/AGT_01`: Remote agent configuration header table. It contains the agent ID and description.
* `/PALANTIR/AGT_02`: Remote agent configuration item table. It contains all agent specific parameters such as RFC connection to agent, resource check settings, pagesize, and more.
* `/PALANTIR/CFG_01`: Connector parameters. It contains Connector-specific parameters such as extractor defaults, object type settings, resource checks, and more.
* `/PALANTIR/CFG_02`: Configuration table for sensitive data. It contains object and field-level settings about data masking, hashing, and encryption.
* `/PALANTIR/CFG_03`: Configuration table for pre-filter. It contains object-level filters for the Connector, independent of the filters on Foundry syncs.
* `/PALANTIR/ENC_01`: Encryption Keys
* `/PALANTIR/INC_01`: Incremental data flow header table. It contains incremental settings such as incremental field, incremental type, and more.
* `/PALANTIR/INC_02`: Incremental data flow item table. It contains historical incremental values that are requested by Foundry and whether these requests are extracted to Foundry successfully.
* `/PALANTIR/JOB`:  Future jobs for page IDs
* `/PALANTIR/PAG_01`: Page header table

## Restore important Connector tables

After completion of your SAP system migration or maintenance, you can install the Connector again. For the data extraction to continue properly, you will need to restore Connector pointers and system settings.

* To restore the tables, run the `/n/palantir/restore` transaction code. This will restore all Connector tables and their content from the backup.
* Check the configuration parameters and content of the tables.
