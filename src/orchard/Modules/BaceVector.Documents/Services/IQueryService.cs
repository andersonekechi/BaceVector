using System.Collections.Generic;
using System.Threading.Tasks;
using BaceVector.Documents.Models;

namespace BaceVector.Documents.Services
{
    public interface IQueryService
    {
        /// <summary>
        /// Ask a question against tenant documents
        /// </summary>
        Task<QueryResult> AskQuestionAsync(string tenantId, string question, List<ConversationMessage> history = null);

        /// <summary>
        /// Get query history for a tenant
        /// </summary>
        Task<IEnumerable<QueryHistoryItem>> GetQueryHistoryAsync(string tenantId, int skip = 0, int take = 50);
    }
}


