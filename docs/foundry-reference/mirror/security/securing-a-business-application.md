<!-- source: https://palantir.com/docs/foundry/security/securing-a-business-application/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Securing an operational application

After building your [data foundation](/docs/foundry/security/securing-a-data-foundation/), you can start building out your ontology and a Flight Alert Inbox application on top of it. The goal is to provide operational users with a valuable workflow while also making the security legible and easy to maintain.

## Object data inherit dataset permissions

With the backing data already transformed, you can create four objects in your ontology: `Flight`, `Flight Alert`, `Delay`, and` Aircraft`. To do this, [create new object types](/docs/foundry/object-link-types/create-object-type/) and pick the backing datasets you already built for each object. During this process, you will be mapping columns in your dataset to properties in the new object type. Each column in the backing dataset will become a property in the new object type, and each row in the backing dataset will become an instance of the object type. Therefore, the data inside an object type will be protected by the permissions of the backing datasets.

For the `Aircraft` object, the data is protected by the permissions on the **/Sky Industries/Aviation \[Ontology]/aircraft** dataset. Therefore, a user in the **Aviation \[Ontology] - Viewer** group on the **Aviation \[Ontology]** Project will be able to see the data in the `Aircraft` object.

![Ontology view](/docs/resources/foundry/security/secure-business-app-0.png)

After creating the necessary objects, you can create the necessary [link types](/docs/foundry/object-link-types/create-link-type/) between the Objects based on how they are related to each other. Below is our ontology.

![Object links in Ontology](/docs/resources/foundry/security/secure-business-app-1.png)

To support your full workflow, you will want to add writeback for some of your objects. Writeback allows editing of the existing property values (for example, to fix incorrect values or to update a status property) but also, and perhaps more importantly, allows for the capture of new data and decisions, which enables compounding of value over time.

To do this, simply generate a writeback dataset in the Editor section. We recommend putting the edited dataset in the same ontology project as the backing dataset (e.g. **Aviation \[Ontology]**), so that the permissions on the object are uniform. The recommended way to edit an object is by using [Actions](/docs/foundry/action-types/overview/), which can also be called via [APIs](/docs/foundry/api/ontology-resources/actions/apply-action/). Below is our Flight Alert object with a writeback dataset.

![Flight alert object with writeback dataset](/docs/resources/foundry/security/secure-business-app-2.png)

Granting users access to your ontology data will all be managed by the groups you created and applied in your data foundation. For example, you would only have to add a new user into the **Aviation \[Ontology] - Viewer** group for them to see the data for all four objects: `Flight`, `Flight Alert`, `Delay`, and `Aircraft`.

## Editing the ontology

You can control who can edit the configuration of specific ontology types by [managing permissions on the project where the resource is stored](/docs/foundry/object-permissioning/ontology-permissions/). Access to ontology resources (such as object types, link types, and action types) is determined by who has access to the relevant project in the [Compass filesystem](/docs/foundry/compass/overview/). For example, to edit the `Flight Alert` object type, a user simply needs the appropriate role on the project that contains it; no additional permissions or roles are required. You can manage these permissions in the **Security** section of each project.

:::callout{theme="neutral"}
Granting a user and/or group a role on an object type only gives them permissions on the object type definition and its metadata and does not grant any permission on the data itself. Permission on the data is managed by the permissions on the backing datasource.
:::

## Restricting instances of objects

Later, we decide that we want to incorporate passenger data, so we integrate and build out a passenger data pipeline.

For compliance reasons, we might want operational users to only see passengers in the country in which they are located (US users can only see US passengers, German users can only see German passengers, and so on). Because our object type is backed by a dataset, its permissions are tied to the dataset as a whole. If we want to restrict permissions on individual rows, we need to back our object type by a Restricted View (a row-permissioned view of a single dataset) or by an object security policy.

To create a Restricted View, navigate to the input dataset resource and select **Create restricted view**, as highlighted below. To configure an object security policy, navigate to the **Security** tab of the object type in Ontology Manager.

![Create restricted view](/docs/resources/foundry/security/secure-business-app-4.png)

The Restricted View wizard will walk you through all the steps. Save the Restricted View in the new **Customer Information \[Restricted]** project we created earlier.

![Create restricted view step 1](/docs/resources/foundry/security/secure-business-app-5.png)

![Create restricted view step 2](/docs/resources/foundry/security/secure-business-app-6.png)

The policy is the core piece of the Restricted View, since it determines what rows users will be able to see. In this example, we will want to:

* Only show rows where the user’s attribute `location:country` matches the value in the `country` column in our dataset, OR
* Show all the rows when the user is a member of the `passenger-data-global-access` group.

Below is what the specific policy would look like:

![Configure a policy](/docs/resources/foundry/security/secure-business-app-7.png)

:::callout{theme="warning"}
Avoid using `NOT` conditions with group, marking, or organization memberships. Using a `NOT` condition in these circumstances is a misconfiguration. The platform supports scoped tokens, which carry only a subset of a user's permissions. These tokens may lack the attribute the `NOT` condition checks against, causing the condition to pass and grant more access than intended.
:::

After the wizard is complete, the Restricted View will be built. After it is built, we can use our Restricted View to back our `Passenger` object. The object type will automatically inherit the Restricted View policy and use that policy to restrict which object instances a user can see.

![Object type with restricted view](/docs/resources/foundry/security/secure-business-app-8.png)

## Giving users access to your application

After the `Flight`, `Flight Alert`, `Delay`, `Aircraft`, and `Passenger` objects were built, we built out the Flight Alert Inbox application for the Operations center by following the [Workshop documentation](/docs/foundry/workshop/getting-started/). Given we want to separate who can edit the Flight Alert Inbox application from those who can edit the ontology data, we will create a new project specifically for the Flight Alert Inbox application. The new project will be called **Flight Alert Inbox**.

To access this project, a user must meet all access requirements. Since there are no Markings associated with the project, users need a role and must be a member of the Sky Industries Organization.

![Access requirements](/docs/resources/foundry/security/secure-business-app-9.png)

Operational consumers will be added to the **Aviation \[Ontology] - Viewer** group to view the `Flight`, `Flight Alert`, `Delay`, `Aircraft`, and `Passenger` data and the **Flight Alert Inbox - Viewer** group to view the Flight Alert Inbox application.

Application developers will be added to the **Aviation \[Ontology] - Viewer** group to view the `Flight`, `Flight Alert`, `Delay`, `Aircraft`, and `Passenger` data and the **Flight Alert Inbox - Editor** group to edit the Flight Alert Inbox application.

Pipeline developers will be added to the **Aviation \[Ontology] - Editor** group to edit the `Flight`, `Flight Alert`, `Delay`, `Aircraft`, and `Passenger` dataset and the **Flight Alert Inbox - Viewer** group to view the workflow downstream of their changes.

![Granting roles](/docs/resources/foundry/security/secure-business-app-10.png)
