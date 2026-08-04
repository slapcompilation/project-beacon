<!-- source: https://palantir.com/docs/foundry/security/project-constraints/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Project constraints

Project constraints allow Project owners to set limits on which markings may or may not be applied on files within a Project. Project constraints prevent users from saving violating files to a Project; learn more about how to [manage Project constraints](/docs/foundry/platform-security-management/manage-project-constraints/). Note that if a dataset violates its Project constraints, it cannot be built until the violation is resolved.

![Project Constraints - Overview](/docs/resources/foundry/security/pmc-1.png)

The three types of Project constraints are listed below:

* **No constraints (default):** All markings are allowed in the Project and can be set as an access requirement.
* **Allowed markings:** Only specified markings are allowed in the Project and can be set as an access requirement in Project files.
* **Prohibited markings:** The specified markings are not allowed in this Project and cannot be set as an access requirement in Project files. This constraint effectively allows data with any marking, except those listed, to be used in the Project.

Project constraints are typically used to prevent users from accidentally joining data. There are situations where users might need access to multiple markings though specific combinations of marked data should not be allowed. To add this protection, an administrator can add Project constraints on the necessary Projects to avoid users from accidentally joining data that should not be joined together.

For example, a bank might have a requirement that sensitive investment data can never be joined with research data for compliance reasons. However, compliance officers may need access to both investment and research data separately to do their work. To prevent a compliance office from ever accidentally joining investment and research data, platform administrators could apply Project constraints of type “Allowed markings”, to protect Projects that contain both investment and research data.
