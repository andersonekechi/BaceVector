using OrchardCore.Modules.Manifest;

[assembly: Module(
    Name = "BaceVector Documents",
    Author = "BaceVector Team",
    Website = "https://bacevector.com",
    Version = "1.0.0",
    Description = "Document management and RAG query interface for BaceVector tenants.",
    Category = "Content Management",
    Dependencies = new[] { "OrchardCore.ContentManagement" }
)]


