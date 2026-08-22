<!-- source: https://palantir.com/docs/foundry/analytics-connectivity/tableau-setup/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Set up

You can access Palantir Foundry datasets from Tableau and use them to build interactive dashboards. To use Foundry with Tableau Desktop, you must have both the Foundry datasets JDBC driver and the Tableau connector file installed on your computer.

Follow the guide below to complete this installation.

## Step 1: Install the JDBC driver for Foundry datasets

Navigate to [Downloads: Foundry Datasets JDBC Driver](/docs/foundry/analytics-connectivity/downloads/#foundry-datasets-jdbc-driver), download the .jar file, and place it in the correct directory for your operating system. Create the directory if it does not already exist.

* If using Windows: `C:\Program Files\Tableau\Drivers`
* If using Mac: `~/Library/Tableau/Drivers`

## Step 2: Install the Tableau connector file

Navigate to [Downloads: Foundry Datasets Tableau Connector](/docs/foundry/analytics-connectivity/downloads/#foundry-datasets-tableau-connector-20211), download the .taco file, and place it in the `My Tableau Repository\Connectors` directory on your computer.

* If using Windows: `C:\Users\[Windows User]\Documents\My Tableau Repository\Connectors`
* If using Mac: `~/Documents/My Tableau Repository/Connectors`

If you cannot find the `My Tableau Repository` folder in the above location, or if after opening Tableau you cannot see the `Foundry by Palantir` connector, your connector folder is located elsewhere. Open Tableau and select `File` -> `Repository Location` to find the correct location. You should never need to create the folder yourself.

## Step 3: Get started building interactive dashboards

Now that you have installed the JDBC driver and the Tableau connector file, you can follow the instructions in the [Tableau: Getting Started Guide](/docs/foundry/analytics-connectivity/tableau-getting-started/) to get started building your first interactive dashboard backed by Foundry data.
