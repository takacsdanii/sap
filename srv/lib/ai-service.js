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
    } catch (e) {}
    return null;
}

const API_KEY = getApiKey();

const genAI = new GoogleGenerativeAI(API_KEY);
const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

console.log('Gemini API ready.');

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
                let wait = (i + 1) * 10000;
                const match = e.message && e.message.match(/retryDelay.*?(\d+)s/);
                if (match) {
                    wait = parseInt(match[1]) * 1000 + 2000;
                }
                console.log(`Rate limited, retrying in ${wait/1000}s... (${i+1}/${maxRetries})`); 
                await new Promise(r => setTimeout(r, wait));
            } else {
                throw e;
            }
        }
    }
}

async function categorizeTicket(ticketDescription, ticketSubject) {
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
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
}

async function generateResponse(ticket, similarSolutions) {
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

async function getEmbedding(text) {
    const result = await withRetry(() => embeddingModel.embedContent(text));
    return result.embedding.values;
}

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
    cosineSimilarity
};
