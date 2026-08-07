<!-- source: https://palantir.com/docs/foundry/data-connection/listeners-subdomains/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Listener subdomains

HTTPS and WebSocket listeners can be mounted to dedicated subdomains allowing for granular ingress control, comprehensive governance workflows, and isolation of less secure endpoints from the environment's primary enrollment domains. All requests to the mounted listeners will then be required to be made over that subdomain.

Listeners can only be mounted to a single subdomain, but a subdomain may be shared by many mounted listeners.

:::callout{theme="neutral" title="Listener subdomains availability"}
Subdomains for listeners are not available self-service in every Foundry enrollment. For use in FedRAMP and on-prem enrollments, contact Palantir Support.
:::

## Creating a listener subdomain

Before mounting a listener to a subdomain, you need to create the subdomain in Control Panel.

Navigate to **Control Panel > Domains & certificates**, find the domain that you would like to create a new subdomain for, and select **Request a listener subdomain**. Once requested, the new subdomain will need to be approved by a user with the `Information Security Officer` role for the enrollment.

![Request a new listener subdomain in Control Panel.](/docs/resources/foundry/data-connection/listeners-request-subdomain.png)

There is a limit of three listener subdomains per enrollment. Contact Palantir support if more are needed.

## Ingress allowlisting

Listener subdomains can be configured in one of two modes: custom ingress or inherited ingress.

### Custom ingress

A subdomain with custom ingress will have a separate ingress configuration from its parent domain. For example, your enrollment may allow ingress from only your corporate IP addresses. However, listener subdomains can be configured to allow ingress from entire countries or specific IP ranges that you otherwise do not want to allow to access the rest of your enrollment.

Configuring appropriately sized ingress allowlists for specific use cases enables you to reduce risk, particularly in instances where listeners are using nonstandard authentication or authorization protocols.

Some example scenarios of ingress configurations for listener subdomains might include:

* Adding country-wide ingress in the regions that the external system is hosted in when they do not publish any specific list of IP addresses, or if their published list changes frequently.
* Configuring a small IP range (smaller than the primary enrollment ingress allow list) to allow requests to a listener with only basic authorization or header secret verification available.

Once the subdomain is created, you can manage ingress in **Control Panel > Network ingress**. [Learn more about ingress configuration.](/docs/foundry/administration/configure-ingress/)

### Inherited ingress

In some situations, the ingress allowlist configured for the primary domain is sufficient for usage with listeners. In these cases, you can create subdomains to inherit the ingress allowlist configuration from the parent domain. Any changes to the ingress configuration of the parent domain will be reflected automatically by the subdomain.

Once created, the subdomain cannot be reconfigured with custom ingress.

## Using a listener subdomain

1. Navigate to the **Listeners** tab in Data Connection and select a listener.
2. In the **Configure connection** step of the listener settings wizard, select a listener subdomain.
3. After requesting a subdomain for your listener, an Approvals request will be created, which an administrator will need to approve before the listener becomes accessible.

![Select a subdomain from the Configure connection step of the listener settings wizard.](/docs/resources/foundry/data-connection/listeners-select-a-subdomain.png)

When the mount is approved, the listener will be able to process requests over the given endpoints (after the listener is started, if it is not already running).

![The subdomain mount is approved and an endpoint is now available.](/docs/resources/foundry/data-connection/listeners-approved-subdomain-mount.png)

### Changing the subdomain for a listener

If you need to change the subdomain that a listener is using, you can select a new one from the **Configure connection** step. This is a destructive action that will cause downtime if the listener is being actively used.

The listener will immediately stop processing requests over the old subdomain, and will not be able to process any further requests until the new subdomain mount is approved. At that point, any usages of the old endpoints will need to be swapped over to the endpoints with the new subdomain.

### Migration to subdomains

For listeners created before subdomains were available in an enrollment, a zero-downtime migration path is available. After creating a new listener subdomain, navigate to the **Configure connection** step of the listener settings wizard and follow the provided instructions.

![Migration instructions for switching to use subdomains shown in the listener settings.](/docs/resources/foundry/data-connection/listeners-subdomain-migration.png)

## Endpoint rotation

If the listener's endpoint is compromised, it can be migrated to a new endpoint with zero downtime.

The steps to migrate endpoint usage are as follows:

1. Generate a new endpoint, and add an expiration date for the old endpoint. You should now have two usable endpoints.
2. Replace any usage of your old endpoint with the new endpoint.
3. Delete the old endpoint.

To support this process, listeners provide an endpoint rotation mechanism. To rotate your endpoint, navigate to the **Configuration** tab of your listener's settings and locate the **Rotate endpoints** option. Note that you can only have a maximum of two endpoints at a time, and a maximum of one *active* endpoint. An active endpoint is an endpoint without a set expiration date.

![The listener's endpoints table shown in the "Configuration" step.](/docs/resources/foundry/data-connection/listener-endpoints-table.png)

When rotating your endpoint, you can choose to set an expiration date for the endpoint for zero-downtime rotations, or to delete it immediately. When an endpoint expires, it will no longer be able to process events.

![The modal for configuring the endpoint rotation.](/docs/resources/foundry/data-connection/listeners-rotate-endpoints-modal.png)

After setting an expiration for an endpoint, you can extend the expiration if more time is needed to migrate your usage over to the new endpoint.

![In the listener's endpoint table, endpoint expirations can be modified.](/docs/resources/foundry/data-connection/listeners-modify-endpoint-expiration.png)

Once an endpoint is expired, you can no longer modify the expiration date. You must delete the expired endpoint and generate a new one by performing another endpoint rotation.

***

*All product names, logos, and brands mentioned are trademarks of their respective owners. All company, product, and service names used in this document are for identification purposes only.*
