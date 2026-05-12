const { GoogleGenerativeAI } = require('@google/generative-ai');

function getApiKey() {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    // Read from BTP User-Provided Service (VCAP_SERVICES)
    try {
        const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
        const ups = vcap['user-provided'];
        if (ups) {
            const geminiSvc = ups.find(s => s.name === 'gemini-api');
            if (geminiSvc) return geminiSvc.credentials.GEMINI_API_KEY;
        }
    } catch (e) { /* ignore parse errors */ }
    return null;
}

const API_KEY = getApiKey();
const MOCK_MODE = !API_KEY;

let genAI = null;
let chatModel = null;
let embeddingModel = null;

function initModels() {
    if (MOCK_MODE) {
        console.warn('[AI Service] No GEMINI_API_KEY found — running in MOCK mode.');
        return;
    }
    genAI = new GoogleGenerativeAI(API_KEY);
    chatModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    console.log('[AI Service] Initialized with Google Gemini API.');
}

initModels();

/**
 * Retry helper for Gemini API rate limits
 */
async function withRetry(fn, maxRetries = 4) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (e) {
            const isRateLimit = e.status === 429
                || e.statusCode === 429
                || (e.message && e.message.includes('429'))
                || (e.message && e.message.includes('RESOURCE_EXHAUSTED'))
                || (e.message && e.message.includes('Too Many Requests'));
            if (isRateLimit && i < maxRetries - 1) {
                // Try to extract retryDelay from error message
                let wait = (i + 1) * 10000;
                const match = e.message && e.message.match(/retryDelay.*?(\d+)s/);
                if (match) {
                    wait = parseInt(match[1]) * 1000 + 2000; // add 2s buffer
                }
                console.log(`[AI Service] Rate limited (attempt ${i+1}/${maxRetries}), waiting ${wait/1000}s...`);
                await new Promise(r => setTimeout(r, wait));
            } else {
                throw e;
            }
        }
    }
}

/**
 * Categorize a ticket: determine type, urgency, and summary
 */
async function categorizeTicket(ticketDescription, ticketSubject) {
    if (MOCK_MODE) {
        return {
            category: 'Technical issue',
            urgency: 'High',
            summary: `[MOCK] Ticket relates to: "${ticketSubject}". The customer reports a technical problem that requires attention.`
        };
    }

    const prompt = `You are an IT support ticket analyzer. Analyze the following support ticket and respond in JSON format only.

Ticket Subject: ${ticketSubject}
Ticket Description: ${ticketDescription}

Respond with this exact JSON structure (no markdown, no code blocks, just raw JSON):
{
  "category": "<one of: Technical issue, Billing inquiry, Product inquiry, Account issue, Delivery problem, Other>",
  "urgency": "<one of: Critical, High, Medium, Low>",
  "summary": "<brief 1-2 sentence summary of the issue>"
}`;

    const result = await withRetry(() => chatModel.generateContent(prompt));
    const text = result.response.text().trim();
    
    // Parse JSON from response (handle possible markdown code blocks)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
}

/**
 * Generate a customer-facing response for a ticket
 */
async function generateResponse(ticket, similarSolutions) {
    if (MOCK_MODE) {
        return `Dear ${ticket.customerName},

Thank you for contacting us regarding "${ticket.ticketSubject}".

We have received your request and our team is looking into it. Based on our analysis, this appears to be a ${ticket.ticketType || 'technical'} issue with your ${ticket.productPurchased || 'product'}.

We will get back to you within 24 hours with a resolution.

Best regards,
Support Team`;
    }

    let context = '';
    if (similarSolutions && similarSolutions.length > 0) {
        context = `\n\nHere are similar past tickets and their resolutions for reference:\n`;
        similarSolutions.forEach((s, i) => {
            context += `${i + 1}. Issue: ${s.ticketSubject} — Resolution: ${s.resolution}\n`;
        });
    }

    const prompt = `You are a professional customer support agent. Generate a helpful, empathetic response to the following customer ticket.

Customer Name: ${ticket.customerName}
Product: ${ticket.productPurchased}
Issue Type: ${ticket.ticketType}
Subject: ${ticket.ticketSubject}
Description: ${ticket.ticketDescription}
${context}

Write a professional response that:
1. Acknowledges the customer's issue
2. Provides actionable steps or a solution
3. Is empathetic and professional
4. Is concise (max 150 words)

Respond with ONLY the email text, no subject line or metadata.`;

    const result = await withRetry(() => chatModel.generateContent(prompt));
    return result.response.text().trim();
}

/**
 * Generate embedding vector for text (for similarity search)
 */
async function getEmbedding(text) {
    if (MOCK_MODE) {
        // Generate a deterministic pseudo-embedding based on text hash
        const hash = simpleHash(text);
        const embedding = [];
        for (let i = 0; i < 768; i++) {
            embedding.push(Math.sin(hash * (i + 1) * 0.001) * 0.5);
        }
        return embedding;
    }

    const result = await withRetry(() => embeddingModel.embedContent(text));
    return result.embedding.values;
}

/**
 * Simple hash function for mock embeddings
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;
    return dotProduct / denominator;
}

module.exports = {
    categorizeTicket,
    generateResponse,
    getEmbedding,
    cosineSimilarity,
    MOCK_MODE
};
