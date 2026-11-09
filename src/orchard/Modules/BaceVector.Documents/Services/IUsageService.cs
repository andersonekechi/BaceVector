using System.Threading.Tasks;
using BaceVector.Documents.Models;

namespace BaceVector.Documents.Services
{
    public interface IUsageService
    {
        /// <summary>
        /// Get current usage and billing information for a tenant
        /// </summary>
        Task<TenantUsage> GetUsageAsync(string tenantId);

        /// <summary>
        /// Check if tenant can perform an action (quota check)
        /// </summary>
        Task<QuotaCheckResult> CheckQuotaAsync(string tenantId, string actionType);
    }
}


