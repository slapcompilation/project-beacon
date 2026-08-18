<!-- source: https://palantir.com/docs/foundry/data-connection/listeners-websocket-security/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# WebSocket listener security

WebSocket listeners differ from standard Foundry data ingestion, so ensure that you understand these security paradigms before enabling your connections.

## Request authorization

Each WebSocket listener type has specific authentication requirements defined by the external system. Listeners implement the security protocols laid out by those external systems, which vary widely. Palantir makes no guarantees about the suitability or effectiveness of these external system protocols.

You are responsible for ensuring that you understand which guarantees each protocol does or does not provide for the incoming connections and data.

The specific protocols implemented for each listener can be found in the **Configure security** section of your listener's **Configure connection** page, as well as the external system's documentation.

## Exportable marking validation

When WebSocket listeners process data, marking validation acts as a security control to prevent unauthorized data exfiltration. The system ensures that any data consumed by your output meets the listener's configured exportable marking requirements.

By default, only data without security markings can be read and incorporated into your compute module inputs. If your compute module needs to process data that carries security markings, you must explicitly configure which markings are permitted for export in the listener's settings. Only a user with the ability to declassify those markings can add them to the configuration.

![Configure WebSocket markings in the listener settings.](./images/websocket-listener-configure-markings.png)

## Subdomains

WebSocket listeners can be mounted to dedicated subdomains, allowing for granular ingress control, comprehensive governance workflows, and isolation of less secure endpoints from the environment's primary enrollment domains. [Learn more about listener subdomains](/docs/foundry/data-connection/listeners-subdomains/).

## Endpoint rotation

If the listener's endpoint is compromised, you can rotate it to a new endpoint. [Learn more about endpoint rotation](/docs/foundry/data-connection/listeners-subdomains/#endpoint-rotation).
