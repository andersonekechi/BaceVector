using System.Threading.Tasks;
using BaceVector.Documents.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using OrchardCore.Modules;

namespace BaceVector.Documents.Controllers
{
    [Authorize]
    [Feature("BaceVector.Documents")]
    public class DocumentController : Controller
    {
        private readonly IDocumentService _documentService;
        private readonly IUsageService _usageService;

        public DocumentController(
            IDocumentService documentService,
            IUsageService usageService)
        {
            _documentService = documentService;
            _usageService = usageService;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var tenantId = GetCurrentTenantId();
            var documents = await _documentService.GetDocumentsAsync(tenantId);
            var usage = await _usageService.GetUsageAsync(tenantId);

            ViewData["Documents"] = documents;
            ViewData["Usage"] = usage;

            return View();
        }

        [HttpGet]
        public IActionResult Upload()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                ModelState.AddModelError("", "Please select a file to upload.");
                return View();
            }

            var tenantId = GetCurrentTenantId();

            // Check quota before upload
            var quotaCheck = await _usageService.CheckQuotaAsync(tenantId, "document");
            if (!quotaCheck.Allowed)
            {
                ModelState.AddModelError("", $"Document limit reached ({quotaCheck.Current}/{quotaCheck.Limit}). Please upgrade your plan.");
                return View();
            }

            using var stream = file.OpenReadStream();
            var result = await _documentService.UploadDocumentAsync(
                tenantId,
                file.FileName,
                stream,
                file.ContentType
            );

            if (result.Success)
            {
                TempData["Message"] = $"Document '{result.Filename}' uploaded successfully and is being processed.";
                return RedirectToAction(nameof(Index));
            }
            else
            {
                ModelState.AddModelError("", $"Upload failed: {result.Error}");
                return View();
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Delete(string documentId)
        {
            var success = await _documentService.DeleteDocumentAsync(documentId);

            if (success)
            {
                TempData["Message"] = "Document deleted successfully.";
            }
            else
            {
                TempData["Error"] = "Failed to delete document.";
            }

            return RedirectToAction(nameof(Index));
        }

        [HttpGet]
        public async Task<IActionResult> Status(string documentId)
        {
            var document = await _documentService.GetDocumentAsync(documentId);
            return Json(document);
        }

        private string GetCurrentTenantId()
        {
            // TODO: Extract from authenticated user claims or tenant context
            return User.FindFirst("TenantId")?.Value ?? "default-tenant";
        }
    }
}


