using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using BaceVector.Documents.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BaceVector.Documents.Services
{
    public class UsageService : IUsageService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<UsageService> _logger;

        public UsageService(
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<UsageService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<TenantUsage> GetUsageAsync(string tenantId)
        {
            try
            {
                var adminUrl = _configuration["BaceVector:Workers:AdminUrl"];
                var httpClient = _httpClientFactory.CreateClient();

                var response = await httpClient.GetAsync($"{adminUrl}/tenants/{tenantId}/usage");
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<TenantUsage>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get usage for tenant {TenantId}", tenantId);
                return null;
            }
        }

        public async Task<QuotaCheckResult> CheckQuotaAsync(string tenantId, string actionType)
        {
            try
            {
                var adminUrl = _configuration["BaceVector:Workers:AdminUrl"];
                var httpClient = _httpClientFactory.CreateClient();

                var response = await httpClient.PostAsync(
                    $"{adminUrl}/tenants/{tenantId}/check-quota",
                    new StringContent($"{{\"type\":\"{actionType}\"}}", System.Text.Encoding.UTF8, "application/json")
                );

                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<QuotaCheckResult>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to check quota for tenant {TenantId}", tenantId);
                return new QuotaCheckResult { Allowed = false };
            }
        }
    }
}


