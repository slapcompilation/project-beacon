<!-- source: https://palantir.com/docs/foundry/monitoring-views/monitoring-faq/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Monitoring FAQ

### Do all health checks now exist as monitoring rules?

Not all health checks exist as monitoring rules, but the most important health checks have analogous monitoring rules. We recommend using a combination of monitoring rules and health checks together in a monitoring view. To summarize coverage from monitoring views and health checks:

* **Resources that can only be monitored with monitoring views:** Data connection agents, objects and links in Object Storage v2 (OSv2), Streaming datasets, live deployments of models, time series syncs, and automations.
* **Dataset-level checks that only exist as health checks:** Content, freshness, and schema checks; data expectations; Object Storage v1 (Phonograph) and `foundry-sync` checks.
* **Monitoring rules that replace functionality from health checks:** Consecutive schedule failures (replacing schedule status checks), schedule duration, and dataset time since job last succeeded monitors.

### Why use monitors over health checks?

Monitors cover an entire scope rather than a single resource. This means that when an additional resource is added to that scope, it is automatically covered by the rule. For example, a monitoring rule that is set up to monitor all agents in a Project will also monitor any further agents added into that Project at a later time.

### When should I create a new monitoring view instead of adding new rules to an existing one?

Each monitoring view should relate to a set of users who care about the monitors that are in that view. If a specific set of users `[a, b, c]` cares about specific Projects `[x, y, z]`, create a single monitoring view with all of the resources in those Projects. If a specific set of users only care about monitoring agents, you should create a single monitoring view to monitor all agents in all Projects.

### What permissions are required for a monitoring view?

Since a monitoring view is a filesystem resource, a user will need permission to the *Project or folder in which the view is saved*. To receive alerts or set up monitoring rules on a resource, the user will need access to the *Project resources* they wish to monitor. Even if a user with all necessary permissions subscribes a user or group to a monitoring view, those new subscribers will not receive alerts on any resources if they do not have explicit access permissions to that monitoring view.
