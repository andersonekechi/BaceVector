using System;
using System.Collections.Generic;

namespace BaceVector.Documents.Models
{
    public enum DocumentStatus
    {
        Pending,
        Processing,
        Completed,
        Failed
    }

    public class DocumentInfo
    {
        public string DocumentId { get; set; }
        public string TenantId { get; set; }
        public string Filename { get; set; }
        public string MimeType { get; set; }
        public long SizeBytes { get; set; }
        public DateTime UploadedAt { get; set; }
        public DocumentStatus Status { get; set; }
        public int? ChunkCount { get; set; }
        public Dictionary<string, object> Metadata { get; set; }
    }

    public class DocumentUploadResult
    {
        public bool Success { get; set; }
        public string DocumentId { get; set; }
        public string Filename { get; set; }
        public DocumentStatus Status { get; set; }
        public string Error { get; set; }
    }

    public class ConversationMessage
    {
        public string Role { get; set; }
        public string Content { get; set; }
    }

    public class QueryResult
    {
        public string Answer { get; set; }
        public SourceReference[] Sources { get; set; }
        public UsageInfo Usage { get; set; }
    }

    public class SourceReference
    {
        public string DocumentId { get; set; }
        public string Chunk { get; set; }
        public double Score { get; set; }
        public Dictionary<string, object> Metadata { get; set; }
    }

    public class UsageInfo
    {
        public int QueryTokens { get; set; }
        public int ResponseTokens { get; set; }
    }

    public class QueryHistoryItem
    {
        public string QueryId { get; set; }
        public string Question { get; set; }
        public string Answer { get; set; }
        public int SourceCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class TenantUsage
    {
        public string TenantId { get; set; }
        public string Plan { get; set; }
        public string Status { get; set; }
        public string CurrentPeriod { get; set; }
        public UsageRecord Usage { get; set; }
        public PlanLimits Limits { get; set; }
    }

    public class UsageRecord
    {
        public int DocumentCount { get; set; }
        public int QueryCount { get; set; }
        public int OverageQueries { get; set; }
        public decimal OverageCharges { get; set; }
    }

    public class PlanLimits
    {
        public int Documents { get; set; }
        public int Queries { get; set; }
    }

    public class QuotaCheckResult
    {
        public bool Allowed { get; set; }
        public bool IsOverage { get; set; }
        public int Current { get; set; }
        public int Limit { get; set; }
    }
}


