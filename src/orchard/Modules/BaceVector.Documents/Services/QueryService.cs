using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using BaceVector.Documents.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BaceVector.Documents.Services
{
    public class QueryService : IQueryService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<QueryService> _logger;

        public QueryService(
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<QueryService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<QueryResult> AskQuestionAsync(
            string tenantId,
            string question,
            List<ConversationMessage> history = null)
        {
            try
            {
                var queryUrl = _configuration["BaceVector:Workers:QueryUrl"];
                var httpClient = _httpClientFactory.CreateClient();

                var payload = new
                {
                    tenantId,
                    question,
                    conversationHistory = history?.Select(m => new { m.Role, m.Content }).ToArray()
                };

                var content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json"
                );

                var response = await httpClient.PostAsync($"{queryUrl}/query", content);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<QueryResult>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to query for tenant {TenantId}", tenantId);
                return new QueryResult
                {
                    Answer = "I'm sorry, I encountered an error processing your question.",
                    Sources = Array.Empty<SourceReference>(),
                    Usage = new UsageInfo { QueryTokens = 0, ResponseTokens = 0 }
                };
            }
        }

        public async Task<IEnumerable<QueryHistoryItem>> GetQueryHistoryAsync(
            string tenantId,
            int skip = 0,
            int take = 50)
        {
            try
            {
                var adminUrl = _configuration["BaceVector:Workers:AdminUrl"];
                var httpClient = _httpClientFactory.CreateClient();

                var response = await httpClient.GetAsync(
                    $"{adminUrl}/tenants/{tenantId}/queries?skip={skip}&take={take}"
                );

                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<IEnumerable<QueryHistoryItem>>(json);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get query history for tenant {TenantId}", tenantId);
                return Array.Empty<QueryHistoryItem>();
            }
        }
    }
}


