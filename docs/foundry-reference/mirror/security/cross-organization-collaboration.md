<!-- source: https://palantir.com/docs/foundry/security/cross-organization-collaboration/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Cross-Organization collaboration

Our Flight Alert Inbox application was very successful and has now become an integral part of our support team’s work. Sky Industries’ leadership has presented the application to multiple partner airlines and it has received great reviews. One airline, Sunrise Airline, now wants to take the operational workflow to the next level. They propose sharing all the internal Sunrise Airline maintenance issues that resulted in delaying passengers with Sky Industries. Combining the maintenance issues data with our flight delay data, Sky Industries and Sunrise Airlines could collaborate to fix recurring maintenance issue and reduce future Sunrise Airline aircraft delays.

The Foundry platform was built to support cross-Organization collaboration. Taking a step back, [Organizations](/docs/foundry/security/orgs-and-spaces/) are access requirements applied to Projects that enforce strict silos between groups of users and resources. Every user is a member of only one Organization but can be a guest member of multiple Organizations.

An enrollment represents an instance of the Foundry platform and is made up of one or more Organizations. In most cases, a company will have a single Organization with all their users in its enrollment. Some enrollments have multiple Organizations to enforce strict silos between groups of users, for example, when multiple companies collaborate in the same Foundry platform.

In our example, we have been operating within a single Foundry enrollment named Sky Industries which has only one identically-named Organization. To onboard Sunrise Airlines, we will need to create a new Organization, spaces, and Ontologies within our Sky Industries enrollment. By setting it up this way, Sky Industries and Sunrise Airlines will be able to collaborate while also having their own private workspace.

## Create an Organization

We need to create a Sunrise Airline Organization so that Sunrise Airline users can protect their private data and only share the data they want to share with Sky Industries. As an enrollment administrator, you can create this new Organization in Control Panel. As part of the Organization creation workflow, you will optionally be able to configure collaboration with other Organizations as well as create a private space and Ontology.

:::callout{theme="neutral"}
You can rename an Organization any time after its creation in [Control Panel's](/docs/foundry/administration/control-panel/) **Organization management** page by selecting **Actions** > **Rename organization**. You must have `Edit organization metadata` permissions for the Organization whose name you edit.
:::

Review the [Organization documentation](/docs/foundry/security/orgs-and-spaces/) to determine whether creating a new Organization is the right choice for your use case.

![Creating an Organization](/docs/resources/foundry/security/create-organization.png)

### Configure collaborations

Collaboration enables users from different organizations to share their data and work together in Foundry. Adding a collaborating organization will allow members of both organizations to discover the name of the other. The discovery of users and groups can then be configured separately for each organization.

In our example, we will make both Sky Industries and Sunrise Airlines mutually discoverable and allow users and groups from both organizations to see each other.

![Adding collaborations](/docs/resources/foundry/security/collaboration-example.png)

### Create a private space and Ontology

A private space and Ontology provide an isolated space for work that should not be shared with other collaborating Organizations. In our case, the space and Ontology will only be accessible to people in the Sunrise Airline Organization.

## Configure an identity provider

Following the creation of the Sunrise Airline Organization, you may need to do some additional setup in Control Panel. Below are some of the steps you may have to perform. Read more detailed instructions in the [Control Panel documentation](/docs/foundry/administration/enrollments-and-organizations/).

* Add the Sunrise Airline identity provider to Control Panel so that Sunrise Airline users can log into Foundry.
* Assign Sunrise Airline users to the Sunrise Airline Organization created above.
* Set up ingress rules so that Sunrise Airline users can reach Foundry from their network.

After completing the steps above, a Sunrise Airline employee should be able to authenticate using their identity provider and log into Foundry.

### Grant administrative permissions

Once the Sunrise Airline administrators have logged into Foundry, you will be able to grant them the necessary Organization roles in Control Panel. Administrative Organization roles should be granted to group(s) that are synced with the Sunrise Airline identity provider. Using a provider group allows any member user to automatically be granted the appropriate roles upon logging in to Foundry. Learn more about [syncing an identity provider’s groups](/docs/foundry/authentication/saml-getting-started/#provider-groups) with Foundry.

## Create a shared space and Ontology

Next, we need to create a shared space and Ontology. They will be marked with both the Sky Industries and Sunrise Airline Organizations so both Organizations can access whatever is shared in this space and Ontology.

We need to grant both Sunrise Airlines and Sky Industries administrators roles on the shared space so they can create Projects and change space settings.

:::callout{theme="neutral"}
In most cases, creating a shared space is self-service for `Enrollment Administrators`, and the associated [shared Ontology](/docs/foundry/ontologies/shared-ontologies/#shared-ontologies) will be created automatically. If you are unable to create a shared space, contact Palantir Support.
:::

![Creating spaces](/docs/resources/foundry/security/cross-org-collab-0.png)

## Create a shared Project

The Sunrise Airline developers will create their own data foundations in their private Sunrise Airline space, similar to what we did for the Sky Industries’ Flight Alerting Inbox application and data foundation. After Sunrise Airline developers build their shareable maintenance dataset, a Sky Industries and/or Sunrise Airline administrator would create a shared Project in the shared space. During or after the Project creation, the administrator will apply both the Sky Industries and Sunrise Airline Organizations to the Project. To do so, you must have the `Apply organization` permission for both Sky Industries and Sunrise Airline Organizations. This is managed in the [Foundry Settings tab](/docs/foundry/platform-security-management/manage-orgs-and-spaces/).

![Create a shared Project](/docs/resources/foundry/security/cross-org-collab-1.png)

Following the same template as other Projects, we will create three new groups to manage permission on this shared Project. Each group should be visible to both Sunrise Airline and Sky Industries.

![Create groups for shared Project](/docs/resources/foundry/security/cross-org-collab-2.png)

## Remove inherited organizations

After the empty shared Project is set up, developers from both organizations can start [referencing](/docs/foundry/security/projects-and-roles/#references) data from their private Projects.

When an Organization references a dataset from their private Projects into a shared space, the dataset continues to inherit the source Organization requirements until explicitly removed. In this case, although the Sky Industries dataset is referenced into a shared space, users from the Sunrise Airline Organization are still blocked from viewing the data. To resolve this, a Sky Industries developer who references a private Sky Industries dataset will need to stop inheriting the upstream Sky Industries Organization. The same process applies to datasets private to Sunrise Airline that Sunrise Airline developers reference in the shared Project.

In the shared Project, a Sky Industries developer will create a code repository file. In the code repository, the Sky Industries developer will need to perform the following:

1. Create a branch
2. Remove any Sky Industries sensitive columns, if any
3. Remove the inherited Sky Industries Organization from the input dataset (using `stop_requiring` syntax)
4. Create the pull request
5. Get necessary approvals and merge the pull request

We recommend reviewing the documentation on how to [remove inherited markings and Organizations](/docs/foundry/building-pipelines/remove-inherited-markings/).

In the example below, the Sky Industries developer filtered the input `aircraft` dataset down to only the Sunrise Airline aircraft and then stopped inheriting the Sky Industries Organization.

![Remove inherited Organizations](/docs/resources/foundry/security/remove-inherited-organizations.png)

After the transform is built, the output `aircraft` dataset will be visible to both the Sunrise Airline and the Sky Industries Organizations. Similarly, Sunrise Airline developers can do the same for data they want to pull into the shared Project. Once both developers have completed sharing their Organizations’ data, they can begin working on the joint application using these shared datasets.

Once inherited Organizations are removed, all the work built on top of the input datasets will be visible to both Organizations. This means that work from this point onward will be shareable.
