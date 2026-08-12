-- Every foreign key gets an index on its leading column.
--
-- The nightly foundry-gap runs have carried this item since the 2026-08-08 QA
-- sweep (61 then, 84 last night) — a repeat infrastructure finding, retired
-- here in one pass. The list was generated from pg_constraint against the
-- live catalog: every public-schema FK whose leading column no index covers.
-- Postgres indexes primary keys, not referencing columns; without these,
-- every ON DELETE walk and every join back from the referencing side scans.

CREATE INDEX IF NOT EXISTS action_type_parameters_object_type_id_idx ON public.action_type_parameters (object_type_id);
CREATE INDEX IF NOT EXISTS action_type_parameters_value_type_id_idx ON public.action_type_parameters (value_type_id);
CREATE INDEX IF NOT EXISTS action_type_rule_properties_parameter_id_idx ON public.action_type_rule_properties (parameter_id);
CREATE INDEX IF NOT EXISTS action_type_rule_properties_property_id_idx ON public.action_type_rule_properties (property_id);
CREATE INDEX IF NOT EXISTS action_type_rules_link_type_id_idx ON public.action_type_rules (link_type_id);
CREATE INDEX IF NOT EXISTS action_type_rules_object_type_id_idx ON public.action_type_rules (object_type_id);
CREATE INDEX IF NOT EXISTS action_type_submission_criteria_parameter_id_idx ON public.action_type_submission_criteria (parameter_id);
CREATE INDEX IF NOT EXISTS action_type_submission_criteria_value_parameter_id_idx ON public.action_type_submission_criteria (value_parameter_id);
CREATE INDEX IF NOT EXISTS action_types_created_by_user_id_idx ON public.action_types (created_by_user_id);
CREATE INDEX IF NOT EXISTS action_types_project_id_idx ON public.action_types (project_id);
CREATE INDEX IF NOT EXISTS branch_roles_user_id_idx ON public.branch_roles (user_id);
CREATE INDEX IF NOT EXISTS dataset_branches_head_transaction_id_idx ON public.dataset_branches (head_transaction_id);
CREATE INDEX IF NOT EXISTS dataset_branches_parent_branch_id_idx ON public.dataset_branches (parent_branch_id);
CREATE INDEX IF NOT EXISTS dataset_files_dataset_id_idx ON public.dataset_files (dataset_id);
CREATE INDEX IF NOT EXISTS dataset_input_marking_stops_marking_id_idx ON public.dataset_input_marking_stops (marking_id);
CREATE INDEX IF NOT EXISTS dataset_schemas_dataset_id_idx ON public.dataset_schemas (dataset_id);
CREATE INDEX IF NOT EXISTS dataset_transactions_created_by_user_id_idx ON public.dataset_transactions (created_by_user_id);
CREATE INDEX IF NOT EXISTS dataset_transactions_dataset_id_idx ON public.dataset_transactions (dataset_id);
CREATE INDEX IF NOT EXISTS dataset_transactions_parent_transaction_id_idx ON public.dataset_transactions (parent_transaction_id);
CREATE INDEX IF NOT EXISTS datasets_created_by_user_id_idx ON public.datasets (created_by_user_id);
CREATE INDEX IF NOT EXISTS datasets_project_id_idx ON public.datasets (project_id);
CREATE INDEX IF NOT EXISTS interface_action_satisfactions_action_type_id_idx ON public.interface_action_satisfactions (action_type_id);
CREATE INDEX IF NOT EXISTS interface_action_satisfactions_constraint_id_idx ON public.interface_action_satisfactions (constraint_id);
CREATE INDEX IF NOT EXISTS interface_extensions_parent_interface_id_idx ON public.interface_extensions (parent_interface_id);
CREATE INDEX IF NOT EXISTS interface_implementation_mappings_interface_property_id_idx ON public.interface_implementation_mappings (interface_property_id);
CREATE INDEX IF NOT EXISTS interface_implementation_mappings_object_property_id_idx ON public.interface_implementation_mappings (object_property_id);
CREATE INDEX IF NOT EXISTS interface_link_constraints_target_interface_id_idx ON public.interface_link_constraints (target_interface_id);
CREATE INDEX IF NOT EXISTS interface_link_constraints_target_object_type_id_idx ON public.interface_link_constraints (target_object_type_id);
CREATE INDEX IF NOT EXISTS interface_properties_shared_property_id_idx ON public.interface_properties (shared_property_id);
CREATE INDEX IF NOT EXISTS interface_properties_value_type_id_idx ON public.interface_properties (value_type_id);
CREATE INDEX IF NOT EXISTS link_types_backing_object_type_id_idx ON public.link_types (backing_object_type_id);
CREATE INDEX IF NOT EXISTS link_types_branch_id_idx ON public.link_types (branch_id);
CREATE INDEX IF NOT EXISTS link_types_created_by_user_id_idx ON public.link_types (created_by_user_id);
CREATE INDEX IF NOT EXISTS link_types_project_id_idx ON public.link_types (project_id);
CREATE INDEX IF NOT EXISTS link_types_target_object_type_id_idx ON public.link_types (target_object_type_id);
CREATE INDEX IF NOT EXISTS marking_categories_created_by_user_id_idx ON public.marking_categories (created_by_user_id);
CREATE INDEX IF NOT EXISTS marking_categories_organization_id_idx ON public.marking_categories (organization_id);
CREATE INDEX IF NOT EXISTS marking_members_user_id_idx ON public.marking_members (user_id);
CREATE INDEX IF NOT EXISTS marking_permissions_user_id_idx ON public.marking_permissions (user_id);
CREATE INDEX IF NOT EXISTS markings_created_by_user_id_idx ON public.markings (created_by_user_id);
CREATE INDEX IF NOT EXISTS object_edits_action_type_id_idx ON public.object_edits (action_type_id);
CREATE INDEX IF NOT EXISTS object_edits_applied_by_user_id_idx ON public.object_edits (applied_by_user_id);
CREATE INDEX IF NOT EXISTS object_sets_created_by_user_id_idx ON public.object_sets (created_by_user_id);
CREATE INDEX IF NOT EXISTS object_type_capabilities_property_id_idx ON public.object_type_capabilities (property_id);
CREATE INDEX IF NOT EXISTS object_type_datasources_added_by_user_id_idx ON public.object_type_datasources (added_by_user_id);
CREATE INDEX IF NOT EXISTS object_type_datasources_branch_id_idx ON public.object_type_datasources (branch_id);
CREATE INDEX IF NOT EXISTS object_type_datasources_timestamp_property_id_idx ON public.object_type_datasources (timestamp_property_id);
CREATE INDEX IF NOT EXISTS object_type_materializations_created_by_user_id_idx ON public.object_type_materializations (created_by_user_id);
CREATE INDEX IF NOT EXISTS object_type_properties_datasource_id_idx ON public.object_type_properties (datasource_id);
CREATE INDEX IF NOT EXISTS object_type_properties_shared_property_id_idx ON public.object_type_properties (shared_property_id);
CREATE INDEX IF NOT EXISTS object_type_properties_value_type_id_idx ON public.object_type_properties (value_type_id);
CREATE INDEX IF NOT EXISTS object_types_created_by_user_id_idx ON public.object_types (created_by_user_id);
CREATE INDEX IF NOT EXISTS object_types_point_of_contact_idx ON public.object_types (point_of_contact);
CREATE INDEX IF NOT EXISTS object_types_project_id_idx ON public.object_types (project_id);
CREATE INDEX IF NOT EXISTS ontologies_created_by_user_id_idx ON public.ontologies (created_by_user_id);
CREATE INDEX IF NOT EXISTS ontology_branches_created_by_user_id_idx ON public.ontology_branches (created_by_user_id);
CREATE INDEX IF NOT EXISTS ontology_interfaces_project_id_idx ON public.ontology_interfaces (project_id);
CREATE INDEX IF NOT EXISTS ontology_proposals_created_by_user_id_idx ON public.ontology_proposals (created_by_user_id);
CREATE INDEX IF NOT EXISTS ontology_role_grants_granted_by_user_id_idx ON public.ontology_role_grants (granted_by_user_id);
CREATE INDEX IF NOT EXISTS ontology_role_grants_user_id_idx ON public.ontology_role_grants (user_id);
CREATE INDEX IF NOT EXISTS organization_guests_granted_by_user_id_idx ON public.organization_guests (granted_by_user_id);
CREATE INDEX IF NOT EXISTS project_resources_organization_id_idx ON public.project_resources (organization_id);
CREATE INDEX IF NOT EXISTS project_role_grants_granted_by_idx ON public.project_role_grants (granted_by);
CREATE INDEX IF NOT EXISTS project_role_grants_organization_id_idx ON public.project_role_grants (organization_id);
CREATE INDEX IF NOT EXISTS project_role_grants_user_id_idx ON public.project_role_grants (user_id);
CREATE INDEX IF NOT EXISTS projects_created_by_user_id_idx ON public.projects (created_by_user_id);
CREATE INDEX IF NOT EXISTS proposal_reviewers_user_id_idx ON public.proposal_reviewers (user_id);
CREATE INDEX IF NOT EXISTS proposal_reviews_user_id_idx ON public.proposal_reviews (user_id);
CREATE INDEX IF NOT EXISTS resource_markings_applied_by_user_id_idx ON public.resource_markings (applied_by_user_id);
CREATE INDEX IF NOT EXISTS scoped_session_markings_marking_id_idx ON public.scoped_session_markings (marking_id);
CREATE INDEX IF NOT EXISTS scoped_sessions_created_by_user_id_idx ON public.scoped_sessions (created_by_user_id);
CREATE INDEX IF NOT EXISTS shared_properties_created_by_user_id_idx ON public.shared_properties (created_by_user_id);
CREATE INDEX IF NOT EXISTS shared_properties_project_id_idx ON public.shared_properties (project_id);
CREATE INDEX IF NOT EXISTS shared_properties_value_type_id_idx ON public.shared_properties (value_type_id);
CREATE INDEX IF NOT EXISTS space_organizations_organization_id_idx ON public.space_organizations (organization_id);
CREATE INDEX IF NOT EXISTS spaces_created_by_user_id_idx ON public.spaces (created_by_user_id);
CREATE INDEX IF NOT EXISTS type_groups_created_by_user_id_idx ON public.type_groups (created_by_user_id);
CREATE INDEX IF NOT EXISTS type_groups_project_id_idx ON public.type_groups (project_id);
CREATE INDEX IF NOT EXISTS user_scoped_session_scoped_session_id_idx ON public.user_scoped_session (scoped_session_id);
CREATE INDEX IF NOT EXISTS users_organization_id_idx ON public.users (organization_id);
CREATE INDEX IF NOT EXISTS value_type_constraints_referenced_value_type_id_idx ON public.value_type_constraints (referenced_value_type_id);
CREATE INDEX IF NOT EXISTS value_types_created_by_user_id_idx ON public.value_types (created_by_user_id);
CREATE INDEX IF NOT EXISTS working_state_changes_branch_id_idx ON public.working_state_changes (branch_id);
CREATE INDEX IF NOT EXISTS working_state_changes_ontology_id_idx ON public.working_state_changes (ontology_id);
