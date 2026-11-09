using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using OrchardCore.Modules;
using BaceVector.Documents.Services;

namespace BaceVector.Documents
{
    public class Startup : StartupBase
    {
        public override void ConfigureServices(IServiceCollection services)
        {
            services.AddScoped<IDocumentService, DocumentService>();
            services.AddScoped<IQueryService, QueryService>();
            services.AddScoped<IUsageService, UsageService>();
        }

        public override void Configure(IApplicationBuilder app, IEndpointRouteBuilder routes, IServiceProvider serviceProvider)
        {
            routes.MapAreaControllerRoute(
                name: "BaceVectorDocuments",
                areaName: "BaceVector.Documents",
                pattern: "Documents/{action}/{id?}",
                defaults: new { controller = "Document", action = "Index" }
            );

            routes.MapAreaControllerRoute(
                name: "BaceVectorQuery",
                areaName: "BaceVector.Documents",
                pattern: "Query/{action}",
                defaults: new { controller = "Query", action = "Index" }
            );
        }
    }
}


