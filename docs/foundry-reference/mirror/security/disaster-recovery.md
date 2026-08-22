<!-- source: https://palantir.com/docs/foundry/security/disaster-recovery/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Disaster recovery

:::callout{theme="neutral"}
This page describes disaster recovery for fully managed cloud deployments. For on-premises or customer-managed-infrastructure deployments, arrangements are defined per environment. Contact Palantir Support for specific details in these scenarios.
:::

Palantir's disaster recovery solution offers protection against two broad categories of disaster scenario:

* Large-scale disruptions, such as the loss of a data center, through high availability infrastructure
* Operational disruptions, such as accidental deletion or data corruption, through routine automated backups

For both of these scenarios, this page outlines how the platform stays available, how data is protected and recovered, and areas of shared responsibility between Palantir and you as a customer.

## High availability

For customers on our fully managed cloud infrastructure, Palantir provides high availability to keep the platform running through hardware and infrastructure failures.

Foundry runs in an active-active configuration across multiple availability zones within a cloud region. Multiple nodes are active at the same time, process requests in parallel, and replicate data bidirectionally. If one node or an entire availability zone becomes unavailable, the remaining nodes continue to serve requests, and failover happens automatically.

Because availability zones within a region are physically separated—with independent power, networking, and cooling—the loss of a single data center does not take the platform offline and does not result in permanent data loss. During such an event the platform may operate in a degraded state (for example, some users may notice reduced performance), but data remains safe and service continues.

## Automated backups

High availability protects against infrastructure failure, but it does not protect against events like accidental deletion or data corruption, where the unwanted change is replicated across all active nodes. To address this, Palantir takes regular backups of the platform.

Different categories of data are protected in different ways.

### Platform metadata and configuration

Palantir uses a service called Rescue to back up and restore the metadata and configuration of the services that make up the platform. This includes data catalog and ontology metadata, ontology edits, user-generated metadata such as Code Repositories and Workshop modules, and related platform state. Backups are taken on a regular cadence, encrypted in transit and at rest, and stored in an encrypted cloud object storage bucket (such as AWS S3, Azure Blob Storage, Google Cloud Storage, or OCI Object Storage). Palantir continuously monitors Rescue to ensure the health of these backups. The retention period defaults to seven days, and can be configured differently on request from your Foundry administrator.

In a disaster scenario, the Rescue backups are used together with data re-ingested from your customer-managed source systems to restore the platform to a recent point in time.

### Customer data in object storage

The metadata/configuration backups described above are limited in scope to database infrastructure and do not cover the files held in object storage, such as AWS S3, Azure Blob Storage, GCP Cloud Storage, or OCI Object Storage. Customer data held in object storage is protected through the native durability and redundancy features of the underlying cloud storage service, such as bucket versioning, which are designed to preserve data against loss.

## Shared responsibility

Palantir is responsible for protecting the Palantir platform and the metadata and configuration that make it run. The customer is responsible for the integrity and backup of data in customer upstream source systems.
