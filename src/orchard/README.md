# Orchard Core Tenant Portal Scaffolding

This folder will host the multi-tenant Orchard Core application that powers the marketing site, tenant provisioning workflow, and admin/employee portals.

> **Note:** The local environment currently lacks the `dotnet` CLI. Install the .NET SDK (8.0+) before running the commands below.

## Initial Setup Steps
1. Install .NET SDK 8.0 or later: <https://dotnet.microsoft.com/download>.
2. Install Orchard Core project templates:
   ```ps1
   dotnet new install OrchardCore.ProjectTemplates::1.8.3
   ```
3. Create the CMS application within this directory:
   ```ps1
   dotnet new occms --name BaceVector.Orchard
   ```
4. Add the SaaS recipe reference in `BaceVector.Orchard/appsettings.json` and configure tenants (`Default`, `Marketing`, `Portal`).
5. Run the site locally:
   ```ps1
   dotnet run --project .\BaceVector.Orchard
   ```

## Next Tasks
- Configure connection string (SQLite for dev, PostgreSQL for staging/prod).
- Enable Orchard Core features: `OrchardCore.SaaS`, `OrchardCore.Users`, `OrchardCore.Admin`.
- Scaffold custom themes and modules (`BaceVector.Theme`, `BaceVector.Module.TenantProvisioning`).
- Integrate Azure AD/Okta SSO for premium tenants.
- Wire Orchard Core with Cloudflare Worker APIs for ingestion/query telemetry.


