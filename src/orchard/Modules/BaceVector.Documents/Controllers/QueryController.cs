using System.Collections.Generic;
using System.Threading.Tasks;
using BaceVector.Documents.Models;
using BaceVector.Documents.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrchardCore.Modules;

namespace BaceVector.Documents.Controllers
{
    [Authorize]
    [Feature("BaceVector.Documents")]
    public class QueryController : Controller
    {
        private readonly IQueryService _queryService;
        private readonly IUsageService _usageService;

        public QueryController(
            IQueryService queryService,
            IUsageService usageService)
        {
            _queryService = queryService;
            _usageService = usageService;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var tenantId = GetCurrentTenantId();
            var usage = await _usageService.GetUsageAsync(tenantId);

            ViewData["Usage"] = usage;
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Ask([FromBody] AskQuestionRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.Question))
            {
                return BadRequest(new { error = "Question is required." });
            }

            var tenantId = GetCurrentTenantId();

            // Check quota (queries are allowed with overage)
            var quotaCheck = await _usageService.CheckQuotaAsync(tenantId, "query");
            
            var result = await _queryService.AskQuestionAsync(
                tenantId,
                request.Question,
                request.History
            );

            return Json(new
            {
                answer = result.Answer,
                sources = result.Sources,
                usage = result.Usage,
                isOverage = quotaCheck.IsOverage
            });
        }

        [HttpGet]
        public async Task<IActionResult> History()
        {
            var tenantId = GetCurrentTenantId();
            var history = await _queryService.GetQueryHistoryAsync(tenantId);

            return View(history);
        }

        private string GetCurrentTenantId()
        {
            // TODO: Extract from authenticated user claims or tenant context
            return User.FindFirst("TenantId")?.Value ?? "default-tenant";
        }
    }

    public class AskQuestionRequest
    {
        public string Question { get; set; }
        public List<ConversationMessage> History { get; set; }
    }
}


