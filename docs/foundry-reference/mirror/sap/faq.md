<!-- source: https://palantir.com/docs/foundry/sap/faq/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Frequently asked questions

This page details some frequently asked questions about the Palantir Foundry Connector 2.0 for SAP Applications ("Connector").

* **Getting connected**
  * **General**
    * [Why does the Connector require an ABAP add-on installed on the SAP ABAP platform of the source SAP systems?](#why-does-the-connector-require-an-abap-add-on-installed-on-the-sap-abap-platform-of-the-source-sap-systems)
  * **Systems & versions**
    * [Which SAP systems does the Connector support?](#which-sap-systems-does-the-connector-support)
    * [What versions of SAP does the Connector support?](#what-versions-of-sap-does-the-connector-support)
    * [Does the Connector support SAP IBP / SAP Ariba / ... ?](#does-the-connector-support-sap-ibp--sap-ariba---)
  * **Certification**
    * [What does “SAP-certified” actually mean?](#what-does-sap-certified-actually-mean)
    * [Where can I find details of the add-on’s certification?](#where-can-i-find-details-of-the-add-ons-certification)
  * **Uninstallation**
    * [Can the add-on be uninstalled?](#can-the-add-on-be-uninstalled)
  * **Load & performance**
    * [How can we be sure that the Connector will not overload our SAP system(s)?](#how-can-we-be-sure-that-the-connector-will-not-overload-our-sap-systems)
  * **Licensing**
    * [Do we need additional SAP licenses to use the Connector?](#do-we-need-additional-sap-licenses-to-use-the-connector)
  * **Security**
    * [Is all data encrypted in transit and at rest?](#is-all-data-encrypted-in-transit-and-at-rest)
    * [What types of authorization roles does the add-on use?](#what-types-of-authorization-roles-does-the-add-on-use)
    * [How can I address SSL issues encountered when trying to sync data to Foundry?](#how-can-i-address-ssl-issues-encountered-when-trying-to-sync-data-to-foundry)
  * **Data integration approach**
    * [Why should we extract data from the source ERP (as opposed to, for example, SAP BW)?](#why-should-we-extract-data-from-the-source-erp-as-opposed-to-for-example-sap-bw)
* **Data extraction**
  * **General**
    * [What types of tables can be extracted from SAP?](#what-types-of-tables-can-be-extracted-from-sap)
    * [How are ABAP data types converted to Foundry data types when data is extracted?](#how-are-abap-data-types-converted-to-foundry-data-types-when-data-is-extracted)
    * [Does the Connector support extracting views?](#does-the-connector-support-extracting-views)
  * **Technical details**
    * [What happens when a data sync runs in Foundry for a given SAP source?](#what-happens-when-a-data-sync-runs-in-foundry-for-a-given-sap-source)
    * [How do I resolve the following data sync errors?](#how-do-i-resolve-the-following-data-sync-errors)
  * **Change data capture**
    * [What options does the Connector provide for incremental syncs / change data capture?](#what-options-does-the-connector-provide-for-incremental-syncs--change-data-capture)
    * [When setting up incremental syncs for an arbitrary table/object in SAP, what would be a good choice of field for `incrementalField`?](#when-setting-up-incremental-syncs-for-an-arbitrary-tableobject-in-sap-what-would-be-a-good-choice-of-field-for-incrementalfield)
    * [Why is the whole table duplicated when switching from transaction type `SNAPSHOT` to `APPEND` (to start incremental data syncs)?](#why-is-the-whole-table-duplicated-when-switching-from-transaction-type-snapshot-to-append-to-start-incremental-data-syncs)
  * **Resource checks**
    * [What types of resource checks are available?](#what-types-of-resource-checks-are-available)
    * [What is the default behavior and how do I override it?](#what-is-the-default-behavior-and-how-do-i-override-it)
  * **SAP business warehouse (BW) features**
    * [Which SAP BW features are supported?](#which-sap-bw-features-are-supported)
  * **Sensitive data**
    * [What options are available to ensure that sensitive data does not leave the SAP system without hindering extraction of required non-sensitive data?](#what-options-are-available-to-ensure-that-sensitive-data-does-not-leave-the-sap-system-without-hindering-extraction-of-required-non-sensitive-data)
* **Writeback**
  * **Technical details**
    * [How is writeback from Foundry to SAP facilitated?](#how-is-writeback-from-foundry-to-sap-facilitated)
  * **Named user attribution**
    * [Is it possible to write back to SAP from Foundry as a named user (rather than a technical user / service account)?](#is-it-possible-to-write-back-to-sap-from-foundry-as-a-named-user-rather-than-a-technical-user--service-account)
* **Connector maintenance**
  * **Upgrades**
    * [How is the SAP add-on upgraded?](#how-is-the-sap-add-on-upgraded)
    * [How often are there new releases of the SAP add-on?](#how-often-are-there-new-releases-of-the-sap-add-on)
  * **Housekeeping**
    * [Does the SAP add-on ensure that its log tables are truncated periodically to avoid the table space being filled up?](#does-the-sap-add-on-ensure-that-its-log-tables-are-truncated-periodically-to-avoid-the-table-space-being-filled-up)

## Getting connected

### General

#### Why does the Connector require an ABAP add-on installed on the SAP ABAP platform of the source SAP systems?

This approach has a number of benefits, including:

* The ability to monitor SAP resource usage to prevent overloading the system.
* Broader access / querying of SAP artifacts (such as views, BW InfoProviders, and BEx queries; not just raw data).
* A rich source exploration experience in Foundry that significantly speeds up the process of finding the relevant data in SAP and allows for bulk data sync creation.
* A wider range of support for incremental data syncs (change data capture).
* More debugging facilities to investigate problems when data syncs fail.

### Systems & versions

#### Which SAP systems does the Connector support?

* SAP R/3, SAP ECC and SAP S/4HANA
* SAP SLT Replication Server (for change data capture)
* SAP BW (including tools such as APO)

#### What versions of SAP does the Connector support?

The SAP-certified add-on runs on the SAP ABAP platform (formerly known as the SAP NetWeaver Application Server), so the SAP\_BASIS component version is most relevant. SAP\_BASIS is the technical component version, applicable to both SAP NetWeaver and SAP S/4HANA systems.
Our recommended minimum SAP\_BASIS versions are as follows:

* SAP\_BASIS 7.4 SP5 or above
* SAP\_BASIS 7.5 (no minimum SP level)

These are minimum versions. The Connector supports all higher SAP\_BASIS versions, including SAP S/4HANA releases based on SAP\_BASIS 8.x (for example, SAP\_BASIS 816).

If you plan to use [SLT via OData](/docs/foundry/sap/configure-sap-slt/#use-odp-via-odata-connector-version-234-sp34-and-above), the OData component (`PALODATA`) requires SAP\_BASIS 7.50 SP09 or above.

If your primary SAP system is running a SAP\_BASIS version lower than 7.4, we have a solution that exposes a subset of the functionality of the Connector. However, this solution still requires a system with SAP\_BASIS version 7.4 or higher to act as a gateway by which Foundry will connect with the earlier version; this application server can be empty or one in use by a newer SAP system, such as BW.

#### Does the Connector support SAP IBP / SAP Ariba / ... ?

If the SAP system or module runs on the SAP ABAP platform then the Connector will be able to extract data from it.

If, however, the SAP system is cloud-based (for example, SAP IBP) or is not ABAP-platform-based (such as SAP Ariba), then this Connector is not the right solution for data extraction. Contact Palantir Support about other options for extracting data from these systems.

### Certification

#### What does “SAP-certified” actually mean?

The official definition of SAP certification is available on [SAP’s site ↗](https://www.sap.com/partners/partner-program/certify-my-solution.html#software).

#### Where can I find details of the add-on’s certification?

The add-on's certification is available on [SAP's website ↗](https://www.sap.com/dmc/exp/sap-certified-solutions/#/solutions?search=Palantir\&id=s:9371650b-d273-4d42-97a0-ce380d570d0b).

### Uninstallation

#### Can the add-on be uninstalled?

Yes – uninstallation is tested as part of the certification process. The add-on uses its own namespace and uninstallation removes everything from the SAP system. The only trace left will be in the `SAINT` installation logs, to show when the add-on was installed and uninstalled.

### Load & Performance

#### How can we be sure that the Connector will not overload our SAP system(s)?

The Connector was designed with SAP system load and performance as a foremost concern. It provides a resource check feature that aims to ensure that data replication from SAP systems does not put end-user experience or other critical processes at risk.

Data extraction is paginated and, prior to every page request, the add-on assesses the memory utilization, CPU utilization (both system and user), and number of running work processes (both dialog and background). If any of these metrics fall outside a set of fully configurable thresholds, extraction will be aborted and retried later when resource availability may be sufficient.

This feature is used across many large enterprises in complex production SAP system landscapes – where the Connector is replicating billions of rows of data – and has been seen to protect those systems from any excess load that may cause disruption to end-users or other running processes.

### Licensing

#### Do we need additional SAP licenses to use the Connector?

:::callout{theme="warning" title="Warning"}
As Palantir is not affiliated with SAP and cannot provide legal advice regarding your SAP license, it is your sole responsibility to assess the scope and details of your existing or potential usage of SAP systems and the Connector and its implications for your SAP licenses and contracts.
:::

In our experience, scheduled extraction of data from SAP ERP systems via the application layer may be considered what SAP refers to as “indirect static read” and the usage of that data in third-party non-SAP systems may not need to be licensed. However, a user writing back data to SAP from a third-party non-SAP system may often require additional SAP licenses.

For any concerns, check with your legal counsel and/or SAP representative to discuss your SAP usage and license.

### Security

#### Is all data encrypted in transit and at rest?

Yes: data transfer from SAP to the Data Connection agent and from the agent to Foundry is over HTTPS; the data that is temporarily staged on the Data Connection agent host machine is encrypted.

#### What types of authorization roles does the add-on use?

There are four types of authorization roles used by the add-on:

* **Service roles:** These roles are required for the add-on to run. Do not modify these roles.
* **Content roles:** These roles are required for data to be extracted from SAP systems. These roles can be modified according to business requirements by copying them.
* **Writeback roles:** These roles are required if writeback to the SAP system from Foundry is enabled.
* **Monitoring and debugging roles:** These roles are required to expose SAP system information to Foundry that enables remote monitoring.

For more details, see [Authorization roles](/docs/foundry/sap/authorization-roles/).

#### How can I address SSL issues encountered when trying to sync data to Foundry?

* `javax.net.ssl.SSLHandshakeException: PKIX path building failed`
  * This means that the Data Connection agent doesn’t have sufficient information to verify that the HTTPS connection to the SAP system is valid.
  * Often, this problem can be fixed by uploading the relevant SSL certificate to the Data Connection agent’s truststore.
  * To download the SSL certificate, run the following command from the (virtual) machine where the Data Connection agent is installed (replacing `$HOST` and `$PORT` with the host and port number for the SAP system):
  ```
  openssl s_client -showcerts -servername $HOST -connect $HOST:$PORT </dev/null 2>/dev/null |sed -ne '/-BEGIN CERTIFICATE-/,/-END CERTIFICATE-/p' | python3 -c "from sys import stdin; text = stdin.read(); ca_cert = text.split('-----BEGIN CERTIFICATE-----')[-1][:-26]; ca_cert = ca_cert.replace('\n', ''); print('\n' + ca_cert)"
  ```
  *Note that this assumes `openssl` and `python3` are installed on the machine.*
  * The command will output a long string representation of the SSL certificate; copy this string to your clipboard.
  * Now, navigate to the configuration page of the Data Connection agent in the Foundry UI.
  * Click on **Agent Settings** > **Manage agent certificates** > **Add a new certificate**.
  * Give the certificate an alias (such as the name of the SAP system it comes from) and paste the certificate from the clipboard into the box titled “**pem...**”.
  * Save the changes and then restart the agent.
* `javax.net.ssl.SSLPeerUnverifiedException: Hostname XXXXX not verified`
  * This usually means that the certificate doesn’t have any SANs (Subject Alternative Names) configured.
  * Since use of the CN (Common Name) to verify the domain has been deprecated, we recommend that you ask the SAP Basis team (or security team) to issue a new certificate using SANs.
  * Although not recommended, for a non-production scenario, it is possible to use the following setting on the SAP source config in Foundry to turn on a legacy hostname verifier: `useLegacyHostnameVerifier: true`.

### Data integration approach

#### Why should we extract data from the source ERP (as opposed to, for example, SAP BW)?

Starting with the most granular source data available helps ensure the most flexible and useful downstream applications of data integration. Using preprocessed data may appear to be a shortcut, but doing so immediately narrows the scope of problems that can be addressed in the future.

If there are existing BW reports or queries that you’d like to use, a good pattern is to extract both the raw ERP data *and* the BW data.

## Data extraction

### General

#### What types of tables can be extracted from SAP?

Transparent, pool, and cluster tables can all be extracted from SAP.

#### How are ABAP data types converted to Foundry data types when data is extracted?

The following table shows how different types are mapped from one system to another.

| SAP ABAP Data Type | Foundry Data Type | Description |
| --- | --- | --- |
| ACCP | String | Posting period |
| CHAR | String | Fixed-length character string |
| CLNT | String | Client field |
| CUKY | String | Currency key (referenced by CURR) |
| CURR | Decimal | Currency field |
| D16D | Decimal | Decimal floating point number saved in BCD format |
| D16N | Decimal | Decimal floating point number |
| D16R | Decimal | Decimal floating point number saved as binary number |
| D16S | Decimal | Decimal floating point number with scaling (obsolete but still used by older systems) |
| D34D | Decimal | Decimal floating point number saved in BCD format |
| D34N | Decimal | Decimal floating point number |
| D34R | Decimal | Decimal floating point number saved as binary number |
| D34S | Decimal | Decimal floating point number with scaling (obsolete but still used by older systems) |
| DATN | Date | Date in format YYYYMMDD (native HANA type DATE) |
| DATS | Date | Date values |
| DEC | Decimal | Signed, fixed-point decimal number |
| FLTP | Double | Floating-point number |
| INT1 | Integer | Very small signed, exact whole number |
| INT2 | Integer | Small signed, exact whole number |
| INT4 | Integer | Regular signed, exact whole number |
| LANG | String | Language key |
| LCHR | String | Fixed-length character string |
| LRAW | Binary | Uninterpreted varying-length byte string |
| NUMC | String | Text string |
| PREC | String | Precision of a QUAN field |
| QUAN | Decimal | Quantity of a DEC field |
| RAW | Binary | An uninterpreted byte string |
| RAWSTRING | Binary | Varying-length character string data |
| TIMS | String\* | Time value |
| UNIT | String | Units key (referenced by QUAN) |

:::callout{theme="neutral"}
Since Foundry does not have a dedicated `Time` data type (distinct from `Date` or `Timestamp`), `TIMS` type is represented as `String`. It is recommended that a `TIMS` type field is combined with its respective `DATS` type field as a first step in a Foundry data transformation pipeline, to form a new `Date` or `Timestamp` field.
:::

#### Does the Connector support extracting views?

There are several types of “view” in SAP:

* **ERP views:** These can be extracted using the “ERP Table” object type; you will see “VIEW” next to the object name in the dropdown list in the sync configuration.
* **ABAP CDS views:** Support for these views was added in SP21 of the add-on.
* **HANA Information views:** Support for these views was added in SP22 of the add-on.

### Technical details

#### What happens when a data sync runs in Foundry for a given SAP source?

The following steps occur when a data sync runs in Foundry for a given SAP source:

1. The Data Connection Coordinator attempts to contact a suitable Data Connection agent to kick off the sync.
2. The SAP plugin running on the Data Connection agent is triggered and starts the sync process.
3. The first request to the SAP add-on is a paging initialization request, which causes the SAP add-on to query the relevant table or object and start writing pages of data (highly compressed) to a table within the `/PALANTIR/` [space](/docs/foundry/security/orgs-and-spaces/#spaces).
4. The subsequent requests to the SAP add-on poll for pages of data sequentially (pausing and retrying if a given page is not yet available) until the last page of data is reached – these pages of data are written as encrypted Apache Parquet files on the Data Connection agent host machine.
5. After the last page of data is retrieved, a paging close request is sent to the SAP add-on.
6. The Data Connection agent now proceeds to upload the Apache Parquet files to Foundry until all the data has been transferred to the target dataset.

#### How do I resolve the following data sync errors?

* `Unexpected value encountered in SAP data Failed to parse value XXX in field YYY`
  * This can occur if a date or number value is malformed and cannot be parsed. Enable [Ignore unexpected values](/docs/foundry/available-connectors/sap-erp/#advanced-settings) on the sync to set unparseable values to `null` and continue.
* `Current CPU user load(X%) is higher than the max. CPU user parameter(Y%)., Please increase CPU_USER threshold value!, System resources are below threshold values.`
  * You may see an error of this form when CPU, memory or work process resource checks fail. The problem is that the relevant system resource is insufficient based on the thresholds that have been defined to protect the system from being overloaded. Sometimes, this may be a desirable result – and the right solution is to wait until the system is less heavily loaded and retry the sync. However, it could also be the case that the resource check threshold in question is too conservative. To learn how to reconfigure the thresholds, see [performance parameters](/docs/foundry/sap/install-sap-connector/#performance-parameters).
* `ERROR : User XXXXX does not have enough authorization for this service call.`
  * This error indicates that the necessary authorization roles have not been generated for the technical user being used by the SAP add-on or that the roles have not been assigned correctly. Review [Authorization roles](/docs/foundry/sap/authorization-roles/).

### Change data capture

#### What options does the Connector provide for incremental syncs / change data capture?

* SAP SLT Replication Server (if available)
  * Data is replicated to Foundry based on triggers in the source ERP.
* SAP ERP or S/4HANA
  * BW Extractors (if available) can be used to replicate data to Foundry based on extractor-managed deltas.
  * The add-on also includes its own comprehensive and flexible approach to change data capture, which can be configured to work with a wide range of standard SAP tables. See [incremental syncs](/docs/foundry/available-connectors/sap-erp/#incremental-syncs) for more details.

#### When setting up incremental syncs for an arbitrary table/object in SAP, what would be a good choice of field for `incrementalField`?

Ideally, the incremental field provided should be a monotonically increasing value; however, it is not always possible to find such a field. The best option may be a date field (with no time component). For this reason, the system uses a "greater than or equal to" comparison (as opposed to just "greater than"), so that no data is omitted if the previous sync was run midway through a given date. As a result, it is possible that duplicate values may appear in the resultant dataset in Foundry. These duplicate values should be removed as a first step in the data transformation pipeline in Foundry; for example, by checking for duplicate rows by primary key. See [incremental syncs](/docs/foundry/available-connectors/sap-erp/#incremental-syncs) for more details.

#### Why is the whole table duplicated when switching from transaction type `SNAPSHOT` to `APPEND` (to start incremental data syncs)?

If a data sync starts off with the `SNAPSHOT` transaction type, then no incremental state is tracked by the Connector. Subsequently switching to `APPEND` will cause the first incremental sync to extract all the data from the SAP system before continuing only to extract the "delta" (what has changed since the previous sync). Therefore, it is advisable to plan in advance which data syncs should be incremental, and to start those with the `APPEND` transaction type.

If a dataset ends up in a state where data has been duplicated due to switching from `SNAPSHOT` to `APPEND`, follow the [reset incremental state](/docs/foundry/available-connectors/sap-erp/#reset-incremental-state) steps.

### Resource checks

#### What types of resource checks are available?

There are three different resource checks available:

* **CPU\_CHECK:** To prevent syncs running if CPU utilization is over a given threshold
* **MEMORY\_CHECK:** to prevent syncs running if memory utilization is over a given threshold
* **PROCESS\_CHECK:** to prevent syncs running if the number of available processes is lower than a given threshold

#### What is the default behavior and how do I override it?

By default, all resource checks are turned on *and* those resource checks are applied “continuously”, meaning that a check will be made before each page is requested, not just at the beginning of the sync.

To override the default behavior on an individual data sync level, take the following steps in the Data Connection UI: **Extras** > **Resource Check** / **Continuous Resource Check** > **Off**.

### SAP business warehouse (BW) features

#### Which SAP BW features are supported?

Data can be extracted from:

* SAP BW InfoProviders – including DataStore Objects (DSOs), InfoCubes, and InfoObjects
* SAP BW BEx Queries

### Sensitive data

#### What options are available to ensure that sensitive data does not leave the SAP system without hindering extraction of required non-sensitive data?

At the highest level, the add-on’s content [authorization roles](/docs/foundry/sap/authorization-roles/) can be modified to prevent extraction of entire tables or objects.

Limiting the data that can be extracted at the row level can be achieved using filters, which are applied *before* the data leaves the SAP system:

* Filters can be defined in the sync configuration in the Data Connection UI in Foundry.
* However, it is also possible to set up “prefilters” in the Connector Cockpit in the SAP system itself – these filters will be applied to a table *in addition to* any filters coming from Foundry, meaning they will also apply to the data previews shown in the Source Explorer and sync configuration UI. For more details, see [Prefilters](/docs/foundry/sap/sap-cockpit/#prefilters).

There are two methods for limiting data extraction by column (these methods, as with the filters described above, are applied *before* the data leaves the SAP system):

* The sync configuration UI offers a “Drop Columns” feature to select which columns to exclude from a data extract.
* The Connector Cockpit offers a range of [encryption and data masking](/docs/foundry/sap/sap-cockpit/#encryption-and-data-masking-configurations) configurations.

## Writeback

### Technical details

#### How is writeback from Foundry to SAP facilitated?

The SAP-certified add-on provides support for calling SAP functions from Foundry. BAPI (Business API) functions are recommended for their well-defined structure and clear failure messages but the add-on supports calling any type of function module, if required.

To set up writeback, you will need to create a Foundry Webhook. For more details, see [Webhooks](/docs/foundry/data-connection/webhooks-overview/) for an overview and [Webhook Configuration - SAP](/docs/foundry/data-connection/webhooks-reference/#sap) for SAP-specific details.

### Named user attribution

#### Is it possible to write back to SAP from Foundry as a named user (rather than a technical user / service account)?

Yes – this is supported using the OAuth 2.0 Authorization Code flow. In this scenario, the SAP system acts as an OAuth 2.0 Server and Foundry acts as an OAuth 2.0 Client. When the user first attempts to write back to SAP from Foundry, they will be redirected to an authorization dialog in the SAP system to confirm that they are willing to permit Foundry to write back to SAP on their behalf.

See [User-attributed SAP writeback with OAuth 2.0](/docs/foundry/sap/oauth2-writeback/) for more details.

## Connector maintenance

### Upgrades

#### How is the SAP add-on upgraded?

You will be provided with a new support package (SP). Follow the [documented instructions to upgrade](/docs/foundry/sap/install-sap-support-package/).

#### How often are there new releases of the SAP add-on?

There is not a fixed release schedule, but a new support package (SP) is typically delivered every 2-3 months.

### Housekeeping

#### Does the SAP add-on ensure that its log tables are truncated periodically to avoid the table space being filled up?

Yes, but you will need to enable the relevant housekeeping jobs as these cannot be turned on automatically by the `SAINT` installation process. For more details, see [Set up and configure housekeeping jobs](/docs/foundry/sap/housekeeping/).
