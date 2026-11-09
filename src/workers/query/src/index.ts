import { Router } from "itty-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type Env = {
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Ai;
  DB: D1Database;
  MAX_RESULTS: string;
  TEMPERATURE: string;
  ADMIN_WORKER_URL: string;
};

type QueryRequest = {
  tenantId: string;
  userId?: string; // Optional for backward compatibility during testing
  question: string;
  conversationHistory?: Array<{ role: string; content: string }>;
};

type QueryResponse = {
  answer: string;
  sources: Array<{
    documentId: string;
    chunk: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  usage: {
    queryTokens: number;
    responseTokens: number;
  };
};

const router = Router();

/**
 * RAG Query Endpoint
 * 1. Embed the user's question using Workers AI
 * 2. Search Vectorize for top-k relevant chunks (filtered by tenantId)
 * 3. Build context from retrieved chunks
 * 4. Generate answer using Workers AI LLM with context
 * 5. Return answer + sources + usage metrics
 */
router.post("/query", async (request: Request, env: Env) => {
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

  const body = (await request.json()) as QueryRequest;

  if (!body?.tenantId || !body?.question) {
    return new Response(
      JSON.stringify({ error: "Missing tenantId or question" }),
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
    // Extract user ID from Authorization header (Session-based auth)
    const authHeader = request.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const sessionToken = authHeader.substring(7);

      // Verify session using D1
      if (env.DB) {
        const session = await env.DB.prepare(
          "SELECT s.user_id FROM sessions s JOIN users u ON s.user_id = u.user_id WHERE s.session_id = ? AND s.expires_at > datetime('now') AND u.tenant_id = ?"
        ).bind(sessionToken, body.tenantId).first();

        if (!session) {
          return new Response(
            JSON.stringify({ error: "Unauthorized", message: "Invalid or expired session" }),
            {
              status: 401,
              headers: {
                "content-type": "application/json",
                "Access-Control-Allow-Origin": "*"
              },
            }
          );
        }
        userId = session.user_id as string;
      }
    } else {
      // Require authentication
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
        {
          status: 401,
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        }
      );
    }
    
    // If no user ID, try to get from request body (for testing)
    if (!userId && body.userId) {
      userId = body.userId;
    }
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "User authentication required. Please log in." }),
        {
          status: 401,
          headers: { 
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        }
      );
    }

    // Check if question is about document metadata/structure
    const metadataKeywords = ['how many lines', 'line count', 'number of lines', 'file size', 'document size', 
                              'how many words', 'word count', 'number of words', 'character count', 'char count',
                              'how many paragraphs', 'paragraph count', 'when was', 'upload date', 'uploaded'];
    const isMetadataQuestion = metadataKeywords.some(keyword => 
      body.question.toLowerCase().includes(keyword)
    );

    // If metadata question, fetch from database instead of vector search
    if (isMetadataQuestion && env.DB) {
      const documents = await env.DB.prepare(
        "SELECT document_id, filename, size_bytes, uploaded_at, chunk_count, metadata FROM documents WHERE tenant_id = ? AND user_id = ? AND status = 'completed' ORDER BY uploaded_at DESC LIMIT 10"
      )
        .bind(body.tenantId, userId)
        .all();

      if (documents.results && documents.results.length > 0) {
        const docs = documents.results.map((doc: any) => {
          const metadata = doc.metadata ? JSON.parse(doc.metadata) : {};
          return {
            documentId: doc.document_id,
            filename: doc.filename,
            sizeBytes: doc.size_bytes,
            uploadedAt: doc.uploaded_at,
            chunkCount: doc.chunk_count,
            lineCount: metadata.lineCount || 'N/A',
            wordCount: metadata.wordCount || 'N/A',
            charCount: metadata.charCount || 'N/A',
            paragraphCount: metadata.paragraphCount || 'N/A'
          };
        });

        // Format answer based on number of documents
        let answer: string;
        
        if (docs.length === 1) {
          // Single document - answer directly
          const doc = docs[0];
          const questionLower = body.question.toLowerCase();
          
          if (questionLower.includes('line')) {
            answer = `The document "${doc.filename}" has ${doc.lineCount} lines.`;
          } else if (questionLower.includes('word')) {
            answer = `The document "${doc.filename}" has ${doc.wordCount} words.`;
          } else if (questionLower.includes('character') || questionLower.includes('char')) {
            answer = `The document "${doc.filename}" has ${doc.charCount} characters.`;
          } else if (questionLower.includes('paragraph')) {
            answer = `The document "${doc.filename}" has ${doc.paragraphCount} paragraphs.`;
          } else if (questionLower.includes('size') || questionLower.includes('file size')) {
            const sizeKB = (doc.sizeBytes / 1024).toFixed(2);
            answer = `The document "${doc.filename}" is ${sizeKB} KB (${doc.sizeBytes} bytes).`;
          } else if (questionLower.includes('upload') || questionLower.includes('when')) {
            answer = `The document "${doc.filename}" was uploaded on ${doc.uploadedAt}.`;
          } else {
            // Use AI for complex questions
            const metadataContext = `Document: ${doc.filename}\n- Lines: ${doc.lineCount}\n- Words: ${doc.wordCount}\n- Characters: ${doc.charCount}\n- Paragraphs: ${doc.paragraphCount}\n- Size: ${(doc.sizeBytes / 1024).toFixed(2)} KB\n- Uploaded: ${doc.uploadedAt}\n- Chunks: ${doc.chunkCount}`;
            const metadataPrompt = `Based on the following document metadata, answer the user's question:\n\n${metadataContext}\n\nQuestion: ${body.question}\n\nAnswer directly and concisely:`;
            
            const llmResponse = await env.AI.run("@cf/meta/llama-3.1-70b-instruct", {
              messages: [
                { role: "system", content: "You are a helpful assistant that answers questions about document metadata. Answer directly and concisely." },
                { role: "user", content: metadataPrompt }
              ],
              temperature: parseFloat(env.TEMPERATURE || "0.3"),
              max_tokens: 200,
            });
            answer = (llmResponse as any).response || "Unable to generate answer.";
          }
        } else {
          // Multiple documents - list all or use AI for complex questions
          const questionLower = body.question.toLowerCase();
          const hasSpecificMetric = questionLower.includes('line') || questionLower.includes('word') || 
                                    questionLower.includes('character') || questionLower.includes('paragraph') ||
                                    questionLower.includes('size');
          
          if (hasSpecificMetric) {
            // List all documents with the requested metric
            const metricName = questionLower.includes('line') ? 'lines' :
                              questionLower.includes('word') ? 'words' :
                              questionLower.includes('character') || questionLower.includes('char') ? 'characters' :
                              questionLower.includes('paragraph') ? 'paragraphs' : 'size';
            
            const docList = docs.map((doc, idx) => {
              const value = metricName === 'lines' ? doc.lineCount :
                           metricName === 'words' ? doc.wordCount :
                           metricName === 'characters' ? doc.charCount :
                           metricName === 'paragraphs' ? doc.paragraphCount :
                           `${(doc.sizeBytes / 1024).toFixed(2)} KB`;
              return `${idx + 1}. "${doc.filename}": ${value} ${metricName}`;
            }).join('\n');
            
            answer = `You have ${docs.length} documents. Here are the ${metricName} for each:\n\n${docList}`;
          } else {
            // Use AI for complex multi-document questions
            const metadataContext = docs.map((doc, idx) => 
              `Document ${idx + 1}: ${doc.filename}\n` +
              `- Lines: ${doc.lineCount}\n` +
              `- Words: ${doc.wordCount}\n` +
              `- Characters: ${doc.charCount}\n` +
              `- Paragraphs: ${doc.paragraphCount}\n` +
              `- Size: ${(doc.sizeBytes / 1024).toFixed(2)} KB\n` +
              `- Uploaded: ${doc.uploadedAt}`
            ).join('\n\n');

            const metadataPrompt = `You have ${docs.length} documents. Based on the following metadata, answer the user's question:\n\n${metadataContext}\n\nQuestion: ${body.question}\n\nAnswer directly:`;

            const llmResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
              messages: [
                { role: "system", content: "You are a helpful assistant. Answer questions about document metadata directly and concisely. If the question doesn't specify which document, provide information for all documents." },
                { role: "user", content: metadataPrompt }
              ],
              temperature: parseFloat(env.TEMPERATURE || "0.3"),
              max_tokens: 300,
            });
            answer = (llmResponse as any).response || "Unable to generate answer.";
          }
        }

        return new Response(JSON.stringify({
          answer,
          sources: docs.map(doc => ({
            documentId: doc.documentId,
            chunk: `Metadata for ${doc.filename}`,
            score: 1.0,
            metadata: doc
          })),
          usage: {
            queryTokens: body.question.split(/\s+/).length,
            responseTokens: answer.split(/\s+/).length
          }
        }), {
          status: 200,
          headers: { 
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }
    }

    // Step 1: Generate embedding for the question
    const embeddingResponse = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
      text: body.question,
    });

    const questionEmbedding = (embeddingResponse as any).data[0];

    // Step 2: Search Vectorize for relevant chunks
    const maxResults = parseInt(env.MAX_RESULTS || "5", 10);
    const searchResults = await env.VECTORIZE_INDEX.query(questionEmbedding, {
      topK: maxResults,
      returnMetadata: true,
    });
    
    // Filter by tenantId AND userId after query (Vectorize filters might not work as expected)
    const filteredMatches = searchResults.matches?.filter(
      (match) => 
        (match.metadata?.tenantId as string) === body.tenantId &&
        (match.metadata?.userId as string) === userId
    ) || [];
    
    const filteredResults = {
      ...searchResults,
      matches: filteredMatches,
    };

    if (!filteredResults.matches || filteredResults.matches.length === 0) {
      return new Response(
        JSON.stringify({
          answer:
            "I couldn't find any relevant information in your documents to answer this question.",
          sources: [],
          usage: { queryTokens: 0, responseTokens: 0 },
        }),
        {
          status: 200,
          headers: { 
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        }
      );
    }

    // Step 3: Build context from top matches
    const sources = filteredResults.matches.map((match) => ({
      documentId: (match.metadata?.documentId as string) || match.id.split('_chunk_')[0],
      chunk: (match.metadata?.text as string) || "",
      score: match.score || 0,
      metadata: match.metadata || {},
    }));

    const context = sources
      .map((s, idx) => `[${idx + 1}] ${s.chunk}`)
      .join("\n\n");

    // Step 4: Generate answer using Workers AI (Upgraded to 70B for reasoning)
    const model = "@cf/meta/llama-3.1-70b-instruct";
    
    const systemPrompt = `You are an intelligent AI assistant capable of complex reasoning and synthesis.
    
Your goal is to provide comprehensive, well-structured answers based on the provided context documents.

Reasoning Steps:
1. Understand the user's intent and specific question.
2. Analyze the provided context documents for relevant information.
3. Synthesize information from multiple sources if available.
4. If asked for a summary, capture the key points concisely.
5. If asked for analysis, provide thoughtful insights based on the text.
6. Always cite your sources using the format [1], [2], etc.

Context Documents:
${context}

Chat History:
${body.conversationHistory ? body.conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n') : 'No history'}

Answer the user's question using ONLY the information provided in the context documents. If the information is not present, say "I couldn't find that information in the provided documents."`;

    const llmResponse = await env.AI.run(model, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: body.question },
      ],
      temperature: parseFloat(env.TEMPERATURE || "0.5"),
      max_tokens: 1024,
    });

    const answer = (llmResponse as any).response;
    
    return new Response(JSON.stringify({
      answer,
      sources,
      usage: {
        queryTokens: body.question.split(/\s+/).length,
        responseTokens: answer.split(/\s+/).length
      }
    }), {
      status: 200,
      headers: { 
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });

    // Step 5: Track usage
    const queryTokens = body.question.split(/\s+/).length;
    const responseTokens = answer.split(/\s+/).length;

    // Increment query count (fire and forget)
    const adminUrl = env.ADMIN_WORKER_URL || "https://admin.bacevector.workers.dev";
    fetch(`${adminUrl}/tenants/${body.tenantId}/usage/increment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "query", count: 1 }),
    }).catch((err) => console.error("Failed to track usage:", err));

    const response: QueryResponse = {
      answer,
      sources,
      usage: {
        queryTokens,
        responseTokens,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        "content-type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  } catch (error) {
    console.error("Query error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process query",
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

/**
 * Health check endpoint
 */
router.get("/healthz", () => {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { 
      "content-type": "application/json",
      ...corsHeaders,
    },
  });
});

// Root route - serve query interface
router.get("/", () => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BaceVector - Ask Questions</title>
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
            max-width: 800px;
            width: 100%;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
        }
        h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
        .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
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
        .question-area {
            margin-bottom: 20px;
        }
        .question-input {
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            min-height: 100px;
            resize: vertical;
            font-family: inherit;
            transition: border-color 0.3s;
        }
        .question-input:focus { outline: none; border-color: #667eea; }
        .ask-btn {
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
            margin-bottom: 20px;
        }
        .ask-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4); }
        .ask-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .status {
            margin-top: 20px;
            padding: 15px;
            border-radius: 8px;
            display: none;
        }
        .status.info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; display: block; }
        .answer-section {
            margin-top: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            display: none;
            max-height: 400px;
            overflow-y: auto;
        }
        .answer-section.show { display: block; }
        .answer-text {
            font-size: 16px;
            line-height: 1.6;
            color: #333;
            margin-bottom: 20px;
            white-space: pre-wrap;
        }
        .sources-title {
            font-weight: 600;
            color: #667eea;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .source-item {
            background: white;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 10px;
            border-left: 3px solid #667eea;
        }
        .source-header {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
        }
        .source-text {
            font-size: 13px;
            color: #555;
            line-height: 1.4;
        }
        .usage-info {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>💬 BaceVector Q&A</h1>
        <p class="subtitle">Ask questions about your uploaded documents</p>
        
        <input type="text" id="tenantId" class="tenant-input" placeholder="Enter Tenant ID (e.g., test-tenant)" value="test-tenant">
        <input type="text" id="userId" class="tenant-input" placeholder="Enter User ID (e.g., user-123)" value="" style="margin-top: 10px;">

        <div class="question-area">
            <textarea id="questionInput" class="question-input" placeholder="Ask anything about your documents... (e.g., What are the key points? Generate presentation questions for my meeting. What should I know about X?)"></textarea>
            <div style="font-size: 12px; color: #999; margin-top: 5px;">
                💡 Your AI assistant analyzes ALL your documents. Ask about content, request presentation questions, or get meeting prep help.
            </div>
        </div>
        
        <button class="ask-btn" id="askBtn" disabled>Ask Question</button>
        
        <div class="status" id="status"></div>
        
        <div class="answer-section" id="answerSection">
            <div class="answer-text" id="answerText"></div>
            <div class="sources-title">📚 Sources:</div>
            <div id="sourcesList"></div>
            <div class="usage-info" id="usageInfo"></div>
        </div>
    </div>
    <script>
        const questionInput = document.getElementById('questionInput');
        const askBtn = document.getElementById('askBtn');
        const tenantInput = document.getElementById('tenantId');
        const userIdInput = document.getElementById('userId');
        const status = document.getElementById('status');
        const answerSection = document.getElementById('answerSection');
        const answerText = document.getElementById('answerText');
        const sourcesList = document.getElementById('sourcesList');
        const usageInfo = document.getElementById('usageInfo');
        
        tenantInput.addEventListener('input', () => {
            askBtn.disabled = !questionInput.value.trim() || !tenantInput.value.trim() || !userIdInput.value.trim();
        });
        
        userIdInput.addEventListener('input', () => {
            askBtn.disabled = !questionInput.value.trim() || !tenantInput.value.trim() || !userIdInput.value.trim();
        });
        
        questionInput.addEventListener('input', () => {
            askBtn.disabled = !questionInput.value.trim() || !tenantInput.value.trim() || !userIdInput.value.trim();
        });
        
        questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey && !askBtn.disabled) {
                askBtn.click();
            }
        });
        
        askBtn.addEventListener('click', async () => {
            const question = questionInput.value.trim();
            const tenantId = tenantInput.value.trim();
            const userId = userIdInput.value.trim();
            
            if (!question || !tenantId || !userId) return;
            
            askBtn.disabled = true;
            askBtn.textContent = 'Thinking...';
            answerSection.classList.remove('show');
            showStatus('Searching your documents...', 'info');
            
            try {
                const authToken = 'Bearer ' + userId + ':' + tenantId + ':token';
                const response = await fetch(window.location.origin + '/query', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': authToken
                    },
                    body: JSON.stringify({ tenantId, userId, question })
                });
                
                let result;
                try {
                    result = await response.json();
                } catch (e) {
                    const text = await response.text();
                    showStatus('❌ Error: Invalid response. Status: ' + response.status + ' - ' + text.substring(0, 200), 'error');
                    askBtn.disabled = false;
                    askBtn.textContent = 'Ask Question';
                    return;
                }
                
                if (response.ok && result.answer) {
                    // Check if answer indicates no relevant info found
                    const noInfoPhrases = ["couldn't find", "no relevant", "no information", "I don't have"];
                    const hasNoInfo = noInfoPhrases.some(phrase => result.answer.toLowerCase().includes(phrase));
                    
                    if (hasNoInfo && (!result.sources || result.sources.length === 0)) {
                        answerText.innerHTML = '<div style="color: #856404; padding: 10px; background: #fff3cd; border-radius: 6px; margin-bottom: 10px;">' +
                            '⚠️ No relevant information found in your documents to answer this question.<br><br>' +
                            '<strong>Try asking:</strong><br>' +
                            '• Questions about document content<br>' +
                            '• Questions about document metadata (line count, word count, file size)<br>' +
                            '• "What information is in the document?"</div>';
                    } else {
                        answerText.textContent = result.answer;
                    }
                    
                    if (result.sources && result.sources.length > 0) {
                        sourcesList.innerHTML = result.sources.map((source, idx) => {
                            const chunkText = source.chunk || '';
                            const preview = chunkText.length > 150 ? chunkText.substring(0, 150) + '...' : chunkText;
                            return '<div class="source-item">' +
                            '<div class="source-header">📄 ' + (source.metadata?.filename || source.documentId) + ' (Relevance: ' + (source.score * 100).toFixed(1) + '%)</div>' +
                            '<div class="source-text">' + preview + '</div>' +
                            '</div>';
                        }).join('');
                    } else {
                        sourcesList.innerHTML = '<div style="color: #999; font-size: 13px;">No sources found</div>';
                    }
                    
                    if (result.usage) {
                        usageInfo.textContent = 'Tokens used: ' + result.usage.queryTokens + ' query + ' + result.usage.responseTokens + ' response';
                    }
                    
                    answerSection.classList.add('show');
                    hideStatus();
                } else {
                    showStatus('❌ Error: ' + (result.error || result.details || 'Query failed'), 'error');
                }
            } catch (error) {
                console.error('Query error:', error);
                showStatus('❌ Error: ' + (error.message || String(error)), 'error');
            } finally {
                askBtn.disabled = false;
                askBtn.textContent = 'Ask Question';
            }
        });
        
        function showStatus(message, type) { 
            status.textContent = message; 
            status.className = 'status ' + type; 
            status.style.display = 'block';
        }
        function hideStatus() { status.style.display = 'none'; }
    </script>
</body>
</html>`;
  
  return new Response(html, {
    status: 200,
    headers: { 
      "content-type": "text/html",
      ...corsHeaders,
    },
  });
});

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    router.handle(request, env, ctx).catch((err) => {
      console.error("Worker error:", err);
      return new Response(JSON.stringify({ 
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err)
      }), {
        status: 500,
        headers: { 
          "content-type": "application/json",
          ...corsHeaders,
        },
      });
    }),
};

