<!-- source: https://palantir.com/docs/foundry/security/protect-data-connector-installation/ · mirrored 2026-08-12 from Palantir Foundry docs -->

# Protecting your on-premise data connector

Palantir Foundry is designed to provide secure collaboration in almost any environment, from the cloud to the edge. If you are running a Foundry data connector agent outside of Palantir’s managed SaaS platform, such as in your own data center or on your own cloud, follow the guidance on this page to protect your installation.

## Physical access

If your Foundry data connector agent is deployed on bare-metal hardware, such as in a data center, it is crucial to implement strong physical security controls. Access to servers running a Foundry data connector agent should be restricted to authorized personnel only.

Any access to Foundry servers should be time-bound, documented, and follow industry best practices. Unauthorized access to the hardware running Foundry could allow an adversary the opportunity to perform various attacks and subvert security controls.

## Data encryption

The Foundry data connector agent implements object-level encryption as part of the data ingestion process. The data connector receives cryptographic key material from the Foundry platform, encrypts the object, and submits it to the Foundry API for ingestion and storage.

### Data in transit

All data transmitted between the data connector and the Foundry API is encrypted using strong encryption protocols and ciphers.

## Network security

### Network segmentation

It is important to segment and separate your Foundry data connector installation from the rest of your environment. Below is a list of best practices for accomplishing this.

* Implement network isolation using firewalls or other technology.
* Use an allowlist of approved protocols, ports, and subnets to gate access to services.
* Deny all inbound traffic by default to your data connector installation.
* Expose your Foundry data connector installation only to the minimum set of networks possible.
* Silo off your Foundry data connector installation in a dedicated private network (VLAN/subnet).
* Maintain a proper inventory of network requirements for the Foundry data connector, which will incorporate all the source data systems from which your organization will be ingesting data. This will be highly variable based on your needs.

### Egress controls

It is important to strictly control network traffic originating from your Foundry data connector installation with egress (outbound) controls.

* Maintain an allowlist of permitted destinations by IP or domain to which your Foundry data connector installation can connect.
* Deny all other network access by your Foundry data connector installation.

### Network security controls

Use network security controls to protect your Palantir Foundry data connector installation.

* Use intrusion detection systems to identify anomalous activity.
* Use firewalls to identify and block network exploitation or attack attempts.
* Collect network security logs from your networks to identify anomalous activity.

## Infrastructure security

### Server hardening

Harden the servers used for your Foundry data connector installation using industry-standard configuration guidance such as CIS or NIST controls.

* Only use a modern, supported operating system.
* Perform aggressive vulnerability management and patching on the hosts used for your Foundry installation.
* Critical security vulnerabilities should be patched in 30 days or less.

### Host security

Use host security controls to protect your Foundry data connector installation.

* Collect audit and security logs from your hosts to identify anomalous activity.
* Use host-based security controls, such as intrusion detection systems, to identify anomalous activity.
* Use data-loss prevention (DLP) technologies to look for unauthorized data transfers.

### Privileged access

It is important to strictly control privileged access to your Foundry data connector installation.

* The backend infrastructure hosting your Foundry data connector installation should be restricted to be accessible exclusively via dedicated bastion servers or jump hosts.
* Multi-factor authentication should be required for all infrastructure or cloud-level access to your Foundry data connector installation.

### Application patching

The Foundry data connector includes the ability to self-update to the latest supported version, minimizing the maintenance requirements for your operational staff.
