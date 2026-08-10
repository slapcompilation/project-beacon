<!-- source: https://www.palantir.com/docs/foundry/superrepo/overview/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# SuperRepo \[Beta]

:::callout{theme="neutral" title="Beta"}
SuperRepo is in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

![A diagram illustrating the SuperRepo architecture built around the Ontology.](/docs/resources/foundry/superrepo/superrepo-cover.png)

SuperRepo is Foundry's new approach to enabling developers to build complex full-stack applications anchored around the Ontology inside a pro-code monorepo. SuperRepos expose an increasing number of the platform's core components, such as [functions](/docs/foundry/functions/overview/), the [Ontology](/docs/foundry/ontology/overview/), and React applications, to allow deeper integration and faster development cycles when developing complex applications.

As more platform features gain first-class SuperRepo support covering an ever-increasing scope of use cases, SuperRepo will be the preferred way of interacting with platform features in a pro-code manner.

SuperRepo aims to improve the application building and delivery experience from two angles:

* **Developer experience:** The integrated full-stack application in a single repository and the [Foundry CLI](/docs/foundry/superrepo/foundry-cli/) allow developers to test their changes across the entire application during the development process, without having to wait between stages. This improves the iteration speed of the developer loop, surfacing issues or breaks immediately.
* **Programmatic DevOps:** SuperRepo allows development teams and administrators to host their code where they choose and then deploy to multiple environments through their CI/CD system of choice, including an integrated one available out of the box. The Foundry CLI enables programmatic DevOps through [Marketplace](/docs/foundry/marketplace/overview/), which allows teams to ship their code in a self-contained, reproducible, and cryptographically signed bundle using the processes that they already have in place.

A central architectural choice of SuperRepo is that it builds around the Ontology, which enables pro-code development teams to build Ontology objects and applications in code while plugging into the powerful Foundry ecosystem.

SuperRepos are best thought of as a new interface for interacting with the platform. For instance, SuperRepo integrates Ontology-as-code by default, allowing a programmatic definition of the application's domain model. Types created in Ontology-as-code are visible in the UI, and types created in the UI can be [imported](/docs/foundry/superrepo/core-concepts/#importing) into Ontology-as-code. Applications are never siloed by how their Ontology types were created.

## Next steps

* Review the [core concepts](/docs/foundry/superrepo/core-concepts/) behind the development, build, and deployment lifecycle of a SuperRepo.
* [Create a SuperRepo](/docs/foundry/superrepo/create-a-superrepo/) in the Palantir platform or from the [Foundry CLI](/docs/foundry/superrepo/foundry-cli/).
* Follow the [end-to-end tutorial](/docs/foundry/superrepo/tutorial-develop-with-a-superrepo/) to import an object type, define a link type, add a function, and expose all of it in an [Ontology SDK](/docs/foundry/ontology-sdk/overview/) application.
