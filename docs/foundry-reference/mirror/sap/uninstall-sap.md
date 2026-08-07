<!-- source: https://palantir.com/docs/foundry/sap/uninstall-sap/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Uninstall the Palantir Foundry Connector 2.0 for SAP Applications or Remote Agent

:::callout{theme="neutral"}
Before uninstallation, run `SA38` and then the `/PALANTIR/UNINSTALL_CORR` program to correct the directory entries of the Palantir Foundry Connector 2.0 for SAP Applications ("Connector") components (**PALANTIR**, **PALCONN**, **PALAGENT**, **PALODATA**).
:::

Use `SAINT` (SAP Add-On Installation Tool) to uninstall the Connector. Note that depending on your circumstances, **PALAGENT** may not be available for the Connector installation.

Uninstall **PALCONN**, **PALAGENT**, and **PALODATA** first or uninstall all components together. If you try to uninstall the **PALANTIR** (Palantir Foundry Foundation) component alone, `SAINT` will raise an error since **PALCONN**, **PALAGENT** and **PALODATA** depend on **PALANTIR**.
