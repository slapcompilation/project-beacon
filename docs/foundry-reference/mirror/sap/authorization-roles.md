<!-- source: https://palantir.com/docs/foundry/sap/authorization-roles/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Authorization roles

## Summary

There are four types of roles used by the Palantir Foundry Connector 2.0 for SAP ("Connector").

* **Service roles:** These roles are required for the Connector to run. Do not modify these roles.
  * **/PALANTIR/SERVICE\_SLT:** Palantir Service Role for SLT
  * **/PALANTIR/SERVICE\_SLT\_740:** Palantir Service Role for SAP\_BASIS 7.4 (the technical component version, applicable to both SAP NetWeaver and SAP S/4HANA systems)
  * **/PALANTIR/SERVICE\_USER:** Palantir Service Role
* **Content roles:** These roles are required for data to be extracted from SAP systems. These roles can be copied and modified according to business requirements.
  * **/PALANTIR/CONTENT\_BEX\_ALL:** BEx Access Roles
  * **/PALANTIR/CONTENT\_DM\_ALL:** Data Model Access Role
  * **/PALANTIR/CONTENT\_EXT\_ALL:** Extractor Content Access
  * **/PALANTIR/CONTENT\_FUNCTION\_ALL:** Function Access Roles
  * **/PALANTIR/CONTENT\_INFOPROV\_ALL:** InfoProvider Content Access
  * **/PALANTIR/CONTENT\_SLT\_ALL:** SLT Access Roles
  * **/PALANTIR/CONTENT\_TABLE\_ALL:** Table Content Access
  * **/PALANTIR/CONTENT\_TCODE\_ALL:** Transaction Code Content Access
  * **/PALANTIR/CONTENT\_HANAVIEW\_ALL:** HANA Information Views Content Access
  * **/PALANTIR/CONTENT\_CDS\_ALL:** ABAP CDS Views Content Access
* **Writeback roles:** These roles are required if writeback to the SAP system from Foundry is enabled.
  * **/PALANTIR/OAUTH\_CLIENT:** Palantir Foundry OAuth 2.0 Client Role
* **Monitoring and debugging roles:** These roles are required to expose SAP system information to Foundry that enables remote monitoring.
  * **/PALANTIR/MONITORING:** Monitoring
  * **/PALANTIR/DEBUG\_USER:** Debug User Access

## Service roles

* **/PALANTIR/SERVICE\_USER:** This is the basic role for a user to run the Connector Services. This role is checked for every request to the Connector. Authorization objects in this role are as follows:
  * **/PALAU/SRV:** Palantir Service Authorization Object with 03 (Display) and 16 (Execute) activities.
  * **S\_BTCH\_JOB:** (Background Processing: Operations on Background Jobs) The Connector runs background jobs (for example, paging or housekeeping operations); therefore, this authorization object is needed.
  * **S\_TCODE:** (Transaction Code Check at Transaction Start) This is only for SU53 and ST22 transactions (Authorization Check Tool and Runtime Errors in SAP), required for debugging and proper logging mechanism.
  * **S\_RFC\_ADM:** (Administration for RFC Destination) This object is to 36 (check) and 39 (extended check) activities to establish whether RFC connection is live and authorization test checked.
  * **S\_RFC:** (Authorization Check for RFC Access) This object is to run remote function calls in SLT and remote agent scenarios with 16 (Execute) activities.
  * **/SDF/E2E:** (Authorization for end-to-end diagnostic) This object is to run a trace from Foundry for the extraction process with 03 (Display) activities.
  * **S\_ADMI\_FCD:** (System Authorizations) This object is to run checks and trace with PADM (Process administration using transactions SM04, SM50), ST0R (Analyze traces), ST22 (Cross-Client Dump Analysis).
  * **S\_BTCH\_JOB:** (Background Processing: Operations on Background Jobs) This object is to run Connector extractions as background jobs with all activities except MODI (Modify Other User's Jobs).
  * **S\_DATASET:** (Authorization for file access) This object is to generate and access trace files by using SAT in SAP with 33 (Read), A6 (Read with filter), A7 (Write with filter) activities.
  * **S\_TABU\_NAM:** (Table Access via Generic Standard Tools) This object is to access /PAL\*, DMC\*, IUUC\* tables with 03 (Display) activity.
  * **S\_TABU\_DIS:** (Table Maintenance (via standard tools such as SM30)) This object is to access tables with 03 (Display) activity.

The following roles are only required if you are connecting to an SAP Landscape Transformation Replication Server:

* **/PALANTIR/SERVICE\_SLT:** This role is required to run SLT APIs. Authorization objects in this role are as follows:
  * **S\_DMIS:** (Authority object for SAP SLO Data migration server) This object is restricted to 03 (Display) activity to check the API endpoints and call them.
* **/PALANTIR/SERVICE\_SLT\_740:** If SAP SLT is running on SAP\_BASIS 7.4+, additional authorization objects are required. These objects are as follows:
  * **S\_DMC\_S\_R:** (MWB: Reading / writing authorization in sender / receiver) This object is required to access SLT Queue for Foundry.
  * **S\_BTCH\_ADM:** (Background Processing: Background Administrator) This object manages background jobs for the Connector on behalf of SAP SLT, such as replication object definitions, replication process objects, and starting replication to the SLT Queue.
  * **S\_DMIS:** (Authority object for SAP SLO Data migration server) This object is restricted to 03 (Display) activity to check the API endpoints and call them.
  * **S\_DMIS\_MOM:** (Authorizations for MWB / Migration Object Modeler)

## Content roles

These roles are included as examples. Adjust the content of the authorization profiles by copying these roles and restricting access to the desired objects in your system.

### Roles for Connector

* **/PALANTIR/CONTENT\_TABLE\_ALL:** This role is required in order to extract data from database tables and views.
  * **/PALAU/TAB:** Palantir Table Authorization Object: All Tables are allowed by default with a `*` wildcard.
* **/PALANTIR/CONTENT\_DM\_ALL**:	This role is required in order to extract the data model from database tables.
  * **/PALAU/DMO:** Palantir Datamodel Authorization Object: All tables allowed by default with a `*` wildcard.
* **/PALANTIR/CONTENT\_FUNCTION\_ALL:** This role is required in order to run RFC functions from SAP systems. Additional authorization may be required depending on the business function used.
  * **/PALAU/FUN:** Palantir Function Authorization Object: All functions are allowed by default with a `*` wildcard.
* **/PALANTIR/CONTENT\_TCODE\_ALL:** This role is required in order to run transaction codes (ALV SE38 Report) from SAP systems. Additional authorization may be required depending on the business function used.
  * **/PALAU/TCO:** Palantir Tcode Authorization Object: All tcodes are allowed by default with a `*` wildcard.
* **/PALANTIR/CONTENT\_HANANVIEW\_ALL:** This role is required in order to extract data from HANA Information Views
  * **/PALAU/HAN:** Palantir HANA Authorization Object: All HANA Information Views are allowed by default with a `*` wildcard.
* **/PALANTIR/CONTENT\_CDS\_ALL:** This role is required in order to extract data from ABAP CDS Views
  * **/PALAU/CDS:** Palantir CDS Authorization Object: All CDS Views are allowed by default with a `*` wildcard.

The following roles are only required if you are connecting to an SAP Business Warehouse (BW) Server:

* **/PALANTIR/CONTENT\_BEX\_ALL:** This role is required in order to extract data from SAP BW (Business Warehouse) BEx queries.
  * **/PALAU/BEX:** (Palantir BEx Authorization Object): All BEx queries are allowed by default with a `*` wildcard.
* **/PALANTIR/CONTENT\_EXT\_ALL**	: This role is required in order to extract data from SAP BW (Business Warehouse) Extractors (ODP Enabled).
  * **/PALAU/EXT:** Palantir Extractor Authorization Object: All ODP Enabled extractors are allowed by default with a `*` wildcard.
* **/PALANTIR/CONTENT\_INFOPROV\_ALL:** This role is required in order to extract data from SAP BW (Business Warehouse) InfoProviders.
  * **/PALAU/INF:** Palantir InfoProvider Authorization Object: All InfoProviders are allowed by default with a `*` wildcard.
  * **S\_RS\_AUTH:** BI Analysis Authorizations in Role: This is All Analysis authorizations in BW systems. Adjust accordingly.
  * **S\_RS\_COMP:** Business Explorer - Components: This is all BEx objects  authorizations in BW systems. Adjust accordingly.
  * **S\_RS\_COMP1:** Business Explorer - Components: Enhancements to the Owner: This is all BEx objects authorizations in BW systems. Adjust accordingly.

The following roles are only required if you are connecting to an SAP Landscape Transformation (SLT) Replication Server:

* **/PALANTIR/CONTENT\_SLT\_ALL**	This role is required in order to extract data from SLT Queues which are replicating tables from the connected system to SAP SLT.
  * **/PALAU/SLT:** (Palantir SLT Authorization Object): All Tables are allowed by default with a `*` wildcard.

## Writeback roles

* **/PALANTIR/OAUTH\_CLIENT:** This role is required when writeback is enabled to the SAP system from Foundry. It provides the required authorization objects for OAuth 2.0 configuration.
  * **S\_SERVICE:** Check at Start of External Services. These services are restricted with `/PALANTIR/*` services.
  * **S\_OA2C\_ADM:** OAuth 2.0 Client Configuration
  * **S\_OA2C\_USE:** OAuth 2.0 Client Use
  * **S\_SCOPE:** OAuth 2.0 Scope. This role is limited to the `/PALANTIR/SRV_0001` scope, which is for Palantir Foundry Writeback using SAP Functions.

## Roles for monitoring and debugging

* **/PALANTIR/MONITORING:** This role is required to enable remote monitoring of the SAP system via the Connector. It provides a wide range of system information such as Runtime Error Analysis (`ST22`), SAP System Logs (`SM21`), SAP Background Job Monitoring (`SM37`), Authorization Analysis (`SU53`), Internet Communication Manager (`ICM`), System Resource Monitoring (`ST02`,`ST06`), SAP SLT Cockpit (`LTRC`), SAP SLT Operational Delta Queue Monitoring (`ODQMON`).
* **/PALANTIR/DEBUG\_USER:** This role is required for Palantir Support in case of an incident; developers may need to debug the issue in the SAP system. This role gathers all required authorization objects for the Connector development team.

## Remote Agent roles

Remote agent roles are identical to the respective roles for the primary connector. These roles can be maintained in the remote system where the Connector Remote Agent is installed.

### Roles for SAP\_BASIS 7.0 and above

* **/PALANTIR/CONTENT\_RBEX\_ALL:** Remote BEx Content Access
* **/PALANTIR/CONTENT\_RFUNCT\_ALL:** Remote Function Content Access
* **/PALANTIR/CONTENT\_RTCODE\_ALL:** Remote Transaction Codes Content Access
* **/PALANTIR/CONTENT\_RINFOPRV\_ALL:** Remote InfoProvider Content Access
* **/PALANTIR/CONTENT\_RTABLE\_ALL:** Remote Table Content Access
* **/PALANTIR/SERVICE\_USER:** Palantir Service Role

### Roles for basis releases 46C, 620 or 640

* **/PALAGT47/CONTENT\_RTABLE\_ALL:** Remote Table Content Access
* **/PALAGT47/SERVICE\_USER:** Palantir Service Role
