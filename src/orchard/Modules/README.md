# Orchard Core Modules

Custom Orchard Core modules will live here. Planned modules:

- `BaceVector.Module.TenantProvisioning` – orchestrates new tenant creation and connects to stripe billing.
- `BaceVector.Module.WorkerBridge` – handles API keys, webhooks, and worker integration.
- `BaceVector.Module.Reporter` – exposes usage dashboards and exports.

Scaffold modules with:

```ps1
dotnet new ocmodule --name BaceVector.Module.TenantProvisioning
```

> Requires `OrchardCore.ProjectTemplates` to be installed (see parent README).


