import { Router } from "itty-router";

type Env = {
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Ai;
  R2_BUCKET: R2Bucket;
  DB: D1Database;
  ADMIN_WORKER_URL: string;
  CHUNK_SIZE: string;
  CHUNK_OVERLAP: string;
};

type IngestionRequest = {
  tenantId: string;
  documentId: string;
  filename: string;
  r2Key: string;
  metadata?: Record<string, unknown>;
};

const router = Router();

/**
 * Chunk text into overlapping segments
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Extract text from buffer based on mime type
 */
async function extractText(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  if (mimeType.includes("text/plain") || mimeType.includes("text/markdown")) {
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(buffer);
  }

  // TODO: Add PDF parsing, DOCX parsing, etc.
  throw new Error(`Unsupported file type: ${mimeType}`);
}

/**
 * Ingestion endpoint
 * 1. Fetch document from R2
 * 2. Extract and chunk text
 * 3. Generate embeddings for each chunk
 * 4. Store vectors in Vectorize
 * 5. Update document status in D1
 */
router.post("/ingest", async (request: Request, env: Env) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Unsupported content type" }), {
      status: 415,
      headers: { 
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }

  const body = (await request.json()) as IngestionRequest;

  if (!body?.tenantId || !body?.documentId || !body?.r2Key) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: tenantId, documentId, r2Key" }),
      {
        status: 400,
        headers: { 
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      }
    );
  }

  try {
    // Update document status to processing
    await env.DB.prepare(
      "UPDATE documents SET status = 'processing' WHERE document_id = ?"
    )
      .bind(body.documentId)
      .run();

    // Step 1: Fetch document from R2
    const r2Object = await env.R2_BUCKET.get(body.r2Key);
    if (!r2Object) {
      throw new Error(`Document not found in R2: ${body.r2Key}`);
    }

    const buffer = await r2Object.arrayBuffer();
    const mimeType = r2Object.httpMetadata?.contentType || "text/plain";

    // Step 2: Extract and chunk text
    const text = await extractText(buffer, mimeType);
    const chunkSize = parseInt(env.CHUNK_SIZE || "512", 10);
    const overlap = parseInt(env.CHUNK_OVERLAP || "128", 10);
    const chunks = chunkText(text, chunkSize, overlap);

    console.log(`Processing ${chunks.length} chunks for document ${body.documentId}`);

    // Step 3 & 4: Generate embeddings and store in Vectorize
    const vectors: VectorizeVector[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Generate embedding using Workers AI
      const embeddingResponse = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
        text: chunk,
      });

      const embedding = (embeddingResponse as any).data[0];

      // For /ingest endpoint, try to get user_id from document record
      let docUserId: string | null = null;
      try {
        const docRecord = await env.DB.prepare(
          "SELECT user_id FROM documents WHERE document_id = ?"
        )
          .bind(body.documentId)
          .first();
        docUserId = (docRecord?.user_id as string) || null;
      } catch (e) {
        // user_id column might not exist yet, use tenantId as fallback
        console.log("user_id column may not exist, using tenantId");
      }
      
      vectors.push({
        id: `${body.documentId}_chunk_${i}`,
        values: embedding,
        metadata: {
          tenantId: body.tenantId,
          userId: docUserId || body.tenantId, // Fallback to tenantId if user_id not available
          documentId: body.documentId,
          chunkIndex: i,
          text: chunk.substring(0, 500), // Limit text to 500 chars
          filename: body.filename,
        },
      });
    }

    // Batch upsert to Vectorize
    await env.VECTORIZE_INDEX.upsert(vectors);

    // Step 5: Update document status to completed
    await env.DB.prepare(
      "UPDATE documents SET status = 'completed', chunk_count = ? WHERE document_id = ?"
    )
      .bind(chunks.length, body.documentId)
      .run();

    // Increment document count for tenant
    await fetch(`${env.ADMIN_WORKER_URL}/tenants/${body.tenantId}/usage/increment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "document", count: 1 }),
    });

    return new Response(
      JSON.stringify({
        status: "completed",
        documentId: body.documentId,
        chunkCount: chunks.length,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Ingestion error:", error);

    // Update document status to failed
    await env.DB.prepare(
      "UPDATE documents SET status = 'failed' WHERE document_id = ?"
    )
      .bind(body.documentId)
      .run();

    return new Response(
      JSON.stringify({
        error: "Failed to process document",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      }
    );
  }
});

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Signup endpoint
 */
router.post("/signup", async (request: Request, env: Env) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400,
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Check if user exists
    const existingUser = await env.DB.prepare(
      "SELECT user_id FROM users WHERE email = ? AND tenant_id = 'test-tenant'"
    ).bind(email).first();

    if (existingUser) {
      return new Response(JSON.stringify({ error: "User already exists" }), {
        status: 409,
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const passwordHash = await hashPassword(password);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create user
    await env.DB.prepare(
      "INSERT INTO users (user_id, tenant_id, email, password_hash, email_verified, role) VALUES (?, 'test-tenant', ?, ?, 1, 'member')"
    ).bind(userId, email, passwordHash).run();

    return new Response(JSON.stringify({
      success: true,
      message: "User created successfully"
    }), {
      headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("Signup error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});

/**
 * Login endpoint - authenticate user and return session token
 */
router.post("/login", async (request: Request, env: Env) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400,
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Find user by email
    console.log("Looking for user:", email);
    const user = await env.DB.prepare(
      "SELECT user_id, password_hash, email_verified FROM users WHERE email = ? AND tenant_id = 'test-tenant'"
    ).bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Verify password
    const computedHash = await hashPassword(password);
    const isValidPassword = computedHash === user.password_hash;

    if (!isValidPassword) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Create session token
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Store session
    await env.DB.prepare(
      "INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(sessionId, user.user_id, expiresAt).run();

    return new Response(JSON.stringify({
      success: true,
      sessionToken: sessionId,
      user: { id: user.user_id, email: email }
    }), {
      headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("Login error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});

/**
 * Get current user info
 */
router.get("/me", async (request: Request, env: Env) => {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No session token" }), {
        status: 401,
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const sessionToken = authHeader.substring(7);

    // Find valid session
    const session = await env.DB.prepare(
      "SELECT s.user_id, u.email FROM sessions s JOIN users u ON s.user_id = u.user_id WHERE s.session_id = ? AND s.expires_at > datetime('now')"
    ).bind(sessionToken).first();

    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({
      user: { id: session.user_id, email: session.email }
    }), {
      headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("Me error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});

/**
 * Upload endpoint - accepts file content directly
 */
router.post("/upload", async (request: Request, env: Env) => {
  let documentId: string | undefined;
  try {
    console.log("Upload request received");
    console.log("Content-Type:", request.headers.get("Content-Type"));
    console.log("Method:", request.method);

    const formData = await request.formData();
    console.log("FormData parsed successfully");

    // Debug form data
    const formDataEntries = [];
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        formDataEntries.push(`${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
      } else {
        formDataEntries.push(`${key}: ${value}`);
      }
    }
    console.log("FormData contents:", formDataEntries);

    const file = formData.get("file") as File;
    const tenantId = formData.get("tenantId") as string;
    const userIdFromForm = formData.get("userId") as string;

    console.log("Extracted values:");
    console.log("- file:", file ? `File(${file.name}, ${file.size} bytes)` : "null");
    console.log("- tenantId:", tenantId || "null");
    console.log("- userIdFromForm:", userIdFromForm || "null");

    if (!file || !tenantId) {
      return new Response(JSON.stringify({ error: "Missing file or tenantId" }), {
        status: 400,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    // Extract user ID from session token in Authorization header
    const authHeader = request.headers.get("Authorization");
    let userId: string | null = null;

    console.log("Auth header:", authHeader ? "present" : "null");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({
        error: "Unauthorized",
        message: "Authentication required. Please log in first."
      }), {
        status: 401,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    const sessionToken = authHeader.substring(7);
    console.log("Session token:", sessionToken.substring(0, 20) + "...");

    // Verify session token
    const session = await env.DB.prepare(
      "SELECT s.user_id, u.email FROM sessions s JOIN users u ON s.user_id = u.user_id WHERE s.session_id = ? AND s.expires_at > datetime('now') AND u.tenant_id = ?"
    ).bind(sessionToken, tenantId).first();

    if (!session) {
      console.log("Session validation failed");
      return new Response(JSON.stringify({
        error: "Unauthorized",
        message: "Invalid or expired session. Please log in again."
      }), {
        status: 401,
        headers: {
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    userId = session.user_id;
    console.log("Authenticated user:", userId, session.email);

    documentId = `doc_${Date.now()}`;
    const r2Key = `${tenantId}/${documentId}/${file.name}`;

    // Upload to R2
    await env.R2_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type || "text/plain",
      },
    });

    // Extract text and calculate metadata BEFORE inserting into database
    const buffer = await file.arrayBuffer();
    const text = await extractText(buffer, file.type || "text/plain");
    
    // Calculate document metadata
    const lineCount = text.split('\n').length;
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = text.length;
    const paragraphCount = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    
    const documentMetadata = JSON.stringify({
      lineCount,
      wordCount,
      charCount,
      paragraphCount,
      uploadedAt: new Date().toISOString()
    });

    // Insert document record with metadata and user_id
    // Note: If user_id column doesn't exist yet, this will need schema migration
    await env.DB.prepare(
      "INSERT INTO documents (document_id, tenant_id, user_id, filename, mime_type, size_bytes, status, r2_key, metadata) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)"
    )
      .bind(documentId, tenantId, userId, file.name, file.type || "text/plain", file.size, r2Key, documentMetadata)
      .run();
    
    const chunkSize = parseInt(env.CHUNK_SIZE || "512", 10);
    const overlap = parseInt(env.CHUNK_OVERLAP || "128", 10);
    const chunks = chunkText(text, chunkSize, overlap);

    const vectors: VectorizeVector[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const embeddingResponse = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
        text: chunks[i],
      });
      const embedding = (embeddingResponse as any).data[0];

      vectors.push({
        id: `${documentId}_chunk_${i}`,
        values: embedding,
        metadata: {
          tenantId,
          userId,
          documentId,
          chunkIndex: i,
          text: chunks[i].substring(0, 500), // Limit text to 500 chars to stay under 10KB metadata limit
          filename: file.name,
        },
      });
    }

    await env.VECTORIZE_INDEX.upsert(vectors);

    await env.DB.prepare(
      "UPDATE documents SET status = 'completed', chunk_count = ? WHERE document_id = ?"
    )
      .bind(chunks.length, documentId)
      .run();

    return new Response(
      JSON.stringify({
        status: "completed",
        documentId,
        filename: file.name,
        chunkCount: chunks.length,
      }),
      {
        status: 200,
        headers: { 
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      }
    );
  } catch (error) {
    console.error("Upload error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error details:", errorMessage);
    
    // Try to update document status to failed if documentId exists
    try {
      if (typeof documentId !== 'undefined') {
        await env.DB.prepare(
          "UPDATE documents SET status = 'failed', error_message = ? WHERE document_id = ?"
        )
          .bind(errorMessage.substring(0, 500), documentId)
          .run();
      }
    } catch (dbError) {
      console.error("Failed to update document status:", dbError);
    }
    
    return new Response(
      JSON.stringify({
        error: "Failed to upload",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { 
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      }
    );
  }
});

router.get("/healthz", () => {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "content-type": "application/json" },
  });
});

// Root route - serve upload form
router.get("/", () => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BaceVector - Document Upload</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            max-width: 600px;
            width: 100%;
        }
        h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
        .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
        .upload-area {
            border: 2px dashed #667eea;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            background: #f8f9ff;
            transition: all 0.3s ease;
            cursor: pointer;
            margin-bottom: 20px;
        }
        .upload-area:hover { border-color: #764ba2; background: #f0f2ff; }
        .upload-area.dragover { border-color: #764ba2; background: #e8ebff; }
        .upload-icon { font-size: 48px; margin-bottom: 15px; }
        .upload-text { color: #667eea; font-weight: 600; margin-bottom: 5px; }
        .upload-hint { color: #999; font-size: 12px; }
        input[type="file"] { display: none; }
        .tenant-input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 20px;
            transition: border-color 0.3s;
        }
        .tenant-input:focus { outline: none; border-color: #667eea; }
        .upload-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .upload-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4); }
        .upload-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .status {
            margin-top: 20px;
            padding: 15px;
            border-radius: 8px;
            display: none;
        }
        .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; display: block; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; display: block; }
        .status.info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; display: block; }
        .file-info {
            margin-top: 15px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
            font-size: 14px;
            color: #666;
        }
        .supported-formats {
            margin-top: 20px;
            padding: 15px;
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            font-size: 13px;
            color: #856404;
        }
        .supported-formats strong { display: block; margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📄 BaceVector Document Upload</h1>
        <p class="subtitle">Upload your documents for AI-powered Q&A</p>
        <div class="supported-formats">
            <strong>📋 Currently Supported Formats:</strong>
            • <strong>.txt</strong> - Plain text files<br>
            • <strong>.md</strong> - Markdown files<br>
            <small style="color: #856404;">(More formats coming soon: PDF, DOCX, HTML)</small>
        </div>
        <input type="text" id="tenantId" class="tenant-input" placeholder="Enter Tenant ID (e.g., test-tenant)" value="test-tenant">
        <input type="text" id="userId" class="tenant-input" placeholder="Enter User ID (e.g., user-123)" value="" style="margin-top: 10px;">
        <div class="upload-area" id="uploadArea">
            <div class="upload-icon">📤</div>
            <div class="upload-text">Click to select file or drag & drop</div>
            <div class="upload-hint">Supports .txt and .md files</div>
            <input type="file" id="fileInput" accept=".txt,.md,text/plain,text/markdown">
        </div>
        <div class="file-info" id="fileInfo" style="display: none;">
            <strong>Selected:</strong> <span id="fileName"></span> (<span id="fileSize"></span>)
        </div>
        <button class="upload-btn" id="uploadBtn" disabled>Upload Document</button>
        <div class="status" id="status"></div>
    </div>
    <script>
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');
        const tenantInput = document.getElementById('tenantId');
        const userIdInput = document.getElementById('userId');
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const status = document.getElementById('status');
        let selectedFile = null;
        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => { handleFileSelect(e.target.files[0]); });
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
        uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('dragover'); });
        uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.classList.remove('dragover'); handleFileSelect(e.dataTransfer.files[0]); });
        function handleFileSelect(file) {
            if (!file) return;
            const validTypes = ['text/plain', 'text/markdown'];
            const validExtensions = ['.txt', '.md'];
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
                showStatus('Please select a .txt or .md file', 'error');
                return;
            }
            selectedFile = file;
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            fileInfo.style.display = 'block';
            uploadBtn.disabled = !tenantInput.value.trim() || !userIdInput.value.trim();
            hideStatus();
        }
        tenantInput.addEventListener('input', () => { uploadBtn.disabled = !selectedFile || !tenantInput.value.trim() || !userIdInput.value.trim(); });
        userIdInput.addEventListener('input', () => { uploadBtn.disabled = !selectedFile || !tenantInput.value.trim() || !userIdInput.value.trim(); });
        uploadBtn.addEventListener('click', async () => {
            if (!selectedFile || !tenantInput.value.trim() || !userIdInput.value.trim()) return;
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
            showStatus('Uploading document...', 'info');
            try {
                const formData = new FormData();
                formData.append('file', selectedFile);
                formData.append('tenantId', tenantInput.value.trim());
                formData.append('userId', userIdInput.value.trim());
                const authToken = 'Bearer ' + userIdInput.value.trim() + ':' + tenantInput.value.trim() + ':token';
                const response = await fetch(window.location.origin + '/upload', { 
                    method: 'POST', 
                    headers: {
                        'Authorization': authToken
                    },
                    body: formData 
                });
                let result;
                try {
                    result = await response.json();
                } catch (e) {
                    const text = await response.text();
                    showStatus('❌ Error: Invalid response from server. Status: ' + response.status + ' - ' + text.substring(0, 200), 'error');
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = 'Upload Document';
                    return;
                }
                if (response.ok && result.status === 'completed') {
                    showStatus('✅ Success! Document "' + result.filename + '" uploaded and processed. (' + result.chunkCount + ' chunk' + (result.chunkCount !== 1 ? 's' : '') + ' created)', 'success');
                    setTimeout(() => {
                        fileInput.value = '';
                        selectedFile = null;
                        fileInfo.style.display = 'none';
                        uploadBtn.disabled = false;
                        uploadBtn.textContent = 'Upload Document';
                    }, 2000);
                } else {
                    showStatus('❌ Error: ' + (result.error || result.details || 'Upload failed. Status: ' + response.status), 'error');
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = 'Upload Document';
                }
            } catch (error) {
                console.error('Upload error:', error);
                showStatus('❌ Error: ' + (error.message || String(error)), 'error');
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Document';
            }
        });
        function showStatus(message, type) { 
            status.textContent = message; 
            status.className = 'status ' + type; 
            status.style.display = 'block';
            console.log('Status:', type, message);
        }
        function hideStatus() { status.style.display = 'none'; }
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        }
    </script>
</body>
</html>`;
  
  return new Response(html, {
    status: 200,
    headers: { 
      "content-type": "text/html",
      "Access-Control-Allow-Origin": "*"
    },
  });
});

// Handle CORS preflight
router.options("*", () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
});

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    router.handle(request, env, ctx).then((response) => {
      if (!response) {
        return new Response(JSON.stringify({ error: "Route not found" }), {
          status: 404,
          headers: { 
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }
      return response;
    }).catch((err) => {
      console.error("Worker error:", err);
      return new Response(JSON.stringify({ 
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err)
      }), {
        status: 500,
        headers: { 
          "content-type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }),
};


