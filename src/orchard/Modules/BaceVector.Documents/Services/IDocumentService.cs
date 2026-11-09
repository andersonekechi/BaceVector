using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using BaceVector.Documents.Models;

namespace BaceVector.Documents.Services
{
    public interface IDocumentService
    {
        /// <summary>
        /// Upload a document for a tenant
        /// </summary>
        Task<DocumentUploadResult> UploadDocumentAsync(string tenantId, string filename, Stream fileStream, string mimeType, Dictionary<string, object> metadata = null);

        /// <summary>
        /// Get all documents for a tenant
        /// </summary>
        Task<IEnumerable<DocumentInfo>> GetDocumentsAsync(string tenantId, int skip = 0, int take = 50);

        /// <summary>
        /// Get a specific document by ID
        /// </summary>
        Task<DocumentInfo> GetDocumentAsync(string documentId);

        /// <summary>
        /// Delete a document
        /// </summary>
        Task<bool> DeleteDocumentAsync(string documentId);

        /// <summary>
        /// Get document processing status
        /// </summary>
        Task<DocumentStatus> GetDocumentStatusAsync(string documentId);
    }
}


