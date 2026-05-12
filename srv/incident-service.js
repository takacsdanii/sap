require('dotenv').config();
const cds = require('@sap/cds');
const aiService = require('./lib/ai-service');

class IncidentService extends cds.ApplicationService {
    async init() {

        // Helper: get DB connection and entity reference (includes embedding field)
        const getDB = async () => {
            const db = await cds.connect.to('db');
            const Tickets = db.entities('sap.cap.incidents').Tickets;
            return { db, Tickets };
        };

        // 1. AI Categorization — analyzes ticket and sets category, urgency, summary
        this.on('categorizeTicket', async (req) => {
            const { ticketID } = req.data;
            const { db, Tickets } = await getDB();

            const ticket = await db.run(SELECT.one.from(Tickets).where({ ID: ticketID }));
            if (!ticket) return req.error(404, `Ticket with ID ${ticketID} not found`);

            const result = await aiService.categorizeTicket(
                ticket.ticketDescription,
                ticket.ticketSubject
            );

            await db.run(UPDATE(Tickets).set({
                aiSummary: result.summary,
                aiCategory: result.category,
                aiUrgency: result.urgency,
                ticketPriority: result.urgency
            }).where({ ID: ticketID }));

            return JSON.stringify(result);
        });

        // 2. AI Response Generation — creates suggested customer response
        this.on('generateResponse', async (req) => {
            const { ticketID } = req.data;
            const { db, Tickets } = await getDB();

            const ticket = await db.run(SELECT.one.from(Tickets).where({ ID: ticketID }));
            if (!ticket) return req.error(404, `Ticket with ID ${ticketID} not found`);

            // Find similar resolved tickets for context (RAG)
            const similarTickets = await this._findSimilar(ticket, 3);
            
            const response = await aiService.generateResponse(ticket, similarTickets);

            await db.run(UPDATE(Tickets).set({
                suggestedResponse: response
            }).where({ ID: ticketID }));

            return response;
        });

        // 3. Find Similar Tickets — RAG-based similarity search
        this.on('findSimilarTickets', async (req) => {
            const { ticketID } = req.data;
            const { db, Tickets } = await getDB();

            const ticket = await db.run(SELECT.one.from(Tickets).where({ ID: ticketID }));
            if (!ticket) return req.error(404, `Ticket with ID ${ticketID} not found`);

            const similar = await this._findSimilar(ticket, 5);
            return JSON.stringify(similar);
        });

        // 4. Embed All Tickets — batch operation, processes `limit` tickets starting at `offset`
        this.on('embedAllTickets', async (req) => {
            const offset = req.data.offset || 0;
            const limit = req.data.limit || 5;
            const { db, Tickets } = await getDB();

            const allTickets = await db.run(SELECT.from(Tickets));
            const total = allTickets.length;
            const batch = allTickets.slice(offset, offset + limit);
            let count = 0;

            for (const ticket of batch) {
                const text = `${ticket.ticketSubject} ${ticket.ticketDescription} ${ticket.resolution || ''}`;
                const embedding = await aiService.getEmbedding(text);
                
                await db.run(UPDATE(Tickets).set({
                    embedding: JSON.stringify(embedding)
                }).where({ ID: ticket.ID }));
                
                count++;
            }

            return JSON.stringify({ embedded: count, offset, total });
        });

        await super.init();
    }

    /**
     * Find tickets similar to the given ticket using vector similarity
     */
    async _findSimilar(ticket, topK = 3) {
        const queryText = `${ticket.ticketSubject} ${ticket.ticketDescription}`;
        const queryEmbedding = await aiService.getEmbedding(queryText);

        const db = await cds.connect.to('db');
        const Tickets = db.entities('sap.cap.incidents').Tickets;
        const allTickets = await db.run(SELECT.from(Tickets).where({ ID: { '!=': ticket.ID } }));

        // Filter in JS — avoids CDS parsing issues with curly braces in data
        const ticketsWithEmbeddings = allTickets.filter(t => t.embedding);

        // Calculate similarity scores
        const scored = ticketsWithEmbeddings
            .map(t => {
                let embedding;
                try {
                    embedding = JSON.parse(t.embedding);
                } catch {
                    return null;
                }
                const score = aiService.cosineSimilarity(queryEmbedding, embedding);
                return {
                    ID: t.ID,
                    ticketSubject: t.ticketSubject,
                    ticketDescription: t.ticketDescription ? t.ticketDescription.substring(0, 200) : '',
                    resolution: t.resolution || 'No resolution yet',
                    ticketStatus: t.ticketStatus,
                    similarity: Math.round(score * 100) / 100
                };
            })
            .filter(t => t !== null)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);

        return scored;
    }
}

module.exports = { IncidentService };
