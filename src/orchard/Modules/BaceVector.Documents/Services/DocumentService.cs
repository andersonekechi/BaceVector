using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using BaceVector.Documents.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BaceVector.Documents.Services
{
    public class DocumentService : IDocumentService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<DocumentService> _logger;

        public DocumentService(
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<DocumentService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<DocumentUploadResult> UploadDocumentAsync(
            string tenantId,
            string filename,
            Stream fileStream,
            string mimeType,
            Dictionary<string, object> metadata = null)
        {
            try
            {
                var documentId = GenerateDocumentId(tenantId, filename);
                var r2Key = $"{tenantId}/{documentId}/{filename}";

                // Step 1: Upload to R2 via Cloudflare API
                var r2Url = _configuration["BaceVector:R2:UploadUrl"];
                var httpClient = _httpClientFactory.CreateClient();

                using var content = new MultipartFormDataContent();
                content.Add(new StreamContent(fileStream), "file", filename);
                content.Add(new StringContent(r2Key), "key");

                var uploadResponse = await httpClient.PostAsync(r2Url, content);
                uploadResponse.EnsureSuccessStatusCode();

                // Step 2: Trigger ingestion worker
                var ingestionUrl = _configuration["BaceVector:Workers:IngestionUrl"];
                var ingestionPayload = new
                {
                    tenantId,
                    documentId,
                    filename,
                    r2Key,
                    metadata
                };

                var ingestionContent = new StringContent(
                    JsonSerializer.Serialize(ingestionPayload),
                    Encoding.UTF8,
                    "application/json"
                );

                var ingestionResponse = await httpClient.PostAsync(
                    $"{ingestionUrl}/ingest",
                    ingestionContent
                );

                ingestionResponse.EnsureSuccessStatusCode();

                return new DocumentUploadResult
                {
                    Success = true,
                    DocumentId = documentId,
                    Filename = filename,
                    Status = DocumentStatus.Processing
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upload document {Filename} for tenant {TenantId}", filename, tenantId);
                return new DocumentUploadResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<IEnumerable<DocumentInfo>> GetDocumentsAsync(string tenantId, int skip = 0, int take = 50)
        {
            try
            {
                var apiUrl = _configuration["BaceVector:Workers:AdminUrl"];
                var httpClient = _httpClientFactory.CreateClient();

                var response = await httpClient.GetAsync(
                    $"{apiUrl}/tenants/{tenantId}/documents?skip={skip}&take={take}"
                );

                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<IEnumerable<DocumentInfo>>(json);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get documents for tenant {TenantId}", tenantId);
                return Array.Empty<DocumentInfo>();
            }
        }

        public async Task<DocumentInfo> GetDocumentAsync(string documentId)
        {
            try
            {
                var apiUrl = _configuration["BaceVector:Workers:AdminUrl"];
                var httpClient = _httpClientFactory.CreateClient();

                var response = await httpClient.GetAsync($"{apiUrl}/documents/{documentId}");
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<DocumentInfo>(json);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get document {DocumentId}", documentId);
                return null;
            }
        }

        public async Task<bool> DeleteDocumentAsync(string documentId)
        {
            try
            {
                var apiUrl = _configuration["BaceVector:Workers:AdminUrl"];
                var httpClient = _httpClientFactory.CreateClient();

                var response = await httpClient.DeleteAsync($"{apiUrl}/documents/{documentId}");
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete document {DocumentId}", documentId);
                return false;
            }
        }

        public async Task<DocumentStatus> GetDocumentStatusAsync(string documentId)
        {
            var doc = await GetDocumentAsync(documentId);
            return doc?.Status ?? DocumentStatus.Failed;
        }

        private string GenerateDocumentId(string tenantId, string filename)
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var random = Guid.NewGuid().ToString("N").Substring(0, 8);
            return $"{tenantId}_{timestamp}_{random}";
        }
    }
}


