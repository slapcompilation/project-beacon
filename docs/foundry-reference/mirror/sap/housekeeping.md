<!-- source: https://palantir.com/docs/foundry/sap/housekeeping/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Set up and configure housekeeping jobs

Housekeeping jobs are used to delete log table data that was created before a specified point in time and to close unconfirmed requests and drop subscriptions that are not in use for a certain period of time.

To open the housekeeping settings, use transaction code `/n/PALANTIR/COCKPIT_03`.

## Deleting Log Tables

The **Deleting Log Tables** checkbox should be left checked by default to prevent log tables from growing indefinitely and potentially filling all available disk space.

When enabled, the program will delete records from tables `/PALANTIR/LOG_02` and `/PALANTIR/PAG_02`. The program also deletes records from the `/PALANTIR/LOG_01` table but does not delete initialization requests in this table. For more, see [Deleting LOG\_01 Table with INIT Requests](#deleting-log_01-table-with-init-requests) below.

* **Logs created older than (days)** and **Data interval (days):** These settings should be used together to define a rolling time window for deleting log records. The default settings are 30 days and 10 days, respectively, meaning that when the job runs, any records between 30 days and 40 (= 30 + 10) days old will be deleted.
* **Only if Data is in Foundry:** This indicates that only page files that are confirmed to have been transferred to Foundry will be deleted.

## Closing SLT Request for Cancelled SLT Syncs

The **Close SLT Requests** checkbox should be unchecked by default. Palantir Support may ask for it to be checked to address a known SLT issue that can cause the system to hang due to too many requests in the ODQDATA table.

When enabled, the program finds the SLT subscription requests that were created in the given date range and uses SLT close functionality to change the `ODQMON` status of the request to `Completed`. When a request is set to `Completed` in `ODQMON`, it can be deleted by the delta queue cleaning job of `ODQMON`.

* **Date range for SLT requests:** SLT delta requests created in this date interval will be set to `Completed` in `ODQMON`.

## Resetting SLT Pointer for Unused Subscription

The **Drop SLT Subscriptions** checkbox should be unchecked by default. Palantir Support may ask for it to be checked to address a known SLT issue that can cause the system to hang due to too many requests in the ODQDATA table.

When enabled, the program will drop historical `ODQMON` subscriptions.

* **Last request older than (days):** Indicates that subscriptions older than this number of days will be dropped.

## Deleting LOG\_01 Table with INIT Requests

The **Delete LOG\_01 INIT Requests** checkbox should be unchecked by default. Palantir Support may ask for it to be checked to address rare cases when the `/PALANTIR/LOG_01` table grows too large.

When enabled, this program deletes the `/PALANTIR/LOG_01` table data, including initialization requests.

* **Logs created older than (days):** Indicates that records older than this number of days will be deleted. The default value is 30 days, which means that all data created more than 30 days ago will be deleted from `/PALANTIR/LOG_01`.
