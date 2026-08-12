<!-- source: https://palantir.com/docs/foundry/security/shared-security-responsibility-model/ · mirrored 2026-08-12 from Palantir Foundry docs -->

# Shared security responsibility model

Security on Foundry is a shared responsibility between Palantir and Palantir’s customers. While Palantir is responsible for Foundry’s security at each level of the service in our control, customers also play a vital role in ensuring their data is protected.

The *shared responsibility model* is a framework that has been adopted by many major cloud-based software companies to delineate security responsibility between the customer and the cloud provider. As the cloud provider, Palantir is responsible for security *of* the cloud, while customers are responsible for security *in* the cloud.

In practice, this means that Palantir and underlying Infrastructure as a Service (IaaS) providers are responsible for securing Foundry by managing physical security, host infrastructure, networking controls, and application security. Meanwhile, customers maintain responsibility over what they choose to host in Foundry: specifically, customer data and user identity/access configuration. The shared responsibility model gives customers control over their data, how they use it, and who can access it, and relieves customers from worry about the security of the underlying infrastructure.

The shared responsibility model can be broken down into the responsibilities of two parties:

| Palantir ↘ | Customer ↘ |
| --- | --- |
| Foundry Services | Customer Data |
| Encryption in transit and at rest | Customer-built Applications |
| Network Traffic Protections | Identity and Access Management (IAM) |
| Operating System, Network, and Firewall Configurations | Resource Permissions (RBAC) |
| Infrastructure-level Monitoring and Alerting | Application-level Monitoring and Alerting |
| Continuous Delivery, Automated Upgrades, and Patching | |
| Foundation Services:<br>→ Compute<br>→ Storage<br>→ Database<br>→ Networking |
| Global Infrastructure:<br>→ Regions<br>→ Availability Zones |

As a customer, some of your responsibilities for protecting your data may vary by environment and architecture, but you are always responsible for the following:

* Managing access and identity for your users via [single sign-on (SSO)](/docs/foundry/security/single-sign-on-security/). This includes enforcing multi-factor authentication. If you do not have a single sign-on provider, we may be able to provide one for you.
* Ensuring any data uploaded to the environment is appropriate and meets your own policies and obligations.
* Ensuring your users apply appropriate [discretionary access controls (roles)](/docs/foundry/security/projects-and-roles/#roles) and [mandatory access controls (markings)](/docs/foundry/security/markings/).
* Monitoring [application-level security audit logs](/docs/foundry/security/monitor-audit-logs/) to ensure usage of your platform by your users is appropriate and meets your own policies and obligations.

Contact your Palantir representative if you have any questions or concerns regarding the shared responsibility model.
