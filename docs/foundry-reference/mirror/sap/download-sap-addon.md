<!-- source: https://palantir.com/docs/foundry/sap/download-sap-addon/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Download the Palantir Foundry Connector 2.0 for SAP Applications add-on

You can download the latest Palantir Foundry Connector 2.0 for SAP Applications add-on from your Foundry enrollment, alongside release notes. Once downloaded, share the packages with the team responsible for installing or updating the add-on, such as the SAP Basis team.

![Download packages section displayed on an existing Foundry source.](/docs/resources/foundry/sap/download-packages-section-existing-source.png)

**For existing installations**, follow the steps below to find this section:

1. Navigate to the existing Foundry SAP source.
2. Select the **Connection settings** tab.
3. Select the **Download packages** step in the left panel.

**For new installations**, follow the steps below to find this section:

1. Navigate to **Data Connection**.
2. Select the **Sources** tab, then **New source** in the top right.
3. Select the **SAP ERP** or **SAP SLT** tile, depending on the type of SAP system you are connecting to.
4. The second step of the installation wizard is **Download packages**.

![Download packages section displayed on a new Foundry source.](/docs/resources/foundry/sap/download-packages-section-new-source.png)

5. On the **Download packages** page, find the section relevant for your installation depending on the SAP\_BASIS (the technical component version, applicable to both SAP NetWeaver and SAP S/4HANA systems) version of the SAP system you are connecting to.
6. Select **Download add-on** to download a ZIP file containing the add-on.
7. Release notes of the add-on can also be downloaded by selection **Release notes** at the top right of the page.

:::callout{theme="neutral"}
For SAP\_BASIS versions below 7.4, [a gateway server is required](/docs/foundry/sap/architecture/#connecting-to-a-remote-sap-erp-system-via-a-gateway), so two packages need to be downloaded and installed.
:::

[Review additional information regarding SAP add-on installation](/docs/foundry/sap/install-sap/).
