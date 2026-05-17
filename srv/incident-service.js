require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const cds = require('@sap/cds');
const aiService = require('./lib/ai-service');

class IncidentService extends cds.ApplicationService {
    async init() {

        const getDB = async () => {
            const db = await cds.connect.to('db');
            const Tickets = cds.entities('sap.cap.incidents').Tickets;
            return { db, Tickets };
        };

        // categorize the selected ticket with Gemini
        this.on('categorizeTicket', 'Tickets', async (req) => {
            const ticketID = req.params[0].ID;
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

            req.info(`Ticket categorized: ${result.category} | Urgency: ${result.urgency}`);
            return JSON.stringify(result);
        });

        // generate a response draft for the customer
        this.on('generateResponse', 'Tickets', async (req) => {
            const ticketID = req.params[0].ID;
            const { db, Tickets } = await getDB();

            const ticket = await db.run(SELECT.one.from(Tickets).where({ ID: ticketID }));
            if (!ticket) return req.error(404, `Ticket with ID ${ticketID} not found`);

            const similarTickets = await this._findSimilar(ticket, 3);
            
            const response = await aiService.generateResponse(ticket, similarTickets);

            await db.run(UPDATE(Tickets).set({
                suggestedResponse: response
            }).where({ ID: ticketID }));

            req.info('AI response generated and saved to Suggested Response field.');
            return response;
        });

        // find tickets with similar content using embeddings
        this.on('findSimilarTickets', 'Tickets', async (req) => {
            const ticketID = req.params[0].ID;
            const { db, Tickets } = await getDB();

            const ticket = await db.run(SELECT.one.from(Tickets).where({ ID: ticketID }));
            if (!ticket) return req.error(404, `Ticket with ID ${ticketID} not found`);

            const similar = await this._findSimilar(ticket, 5);
            req.info(`Found ${similar.length} similar ticket(s).`);
            return JSON.stringify(similar);
        });

        // generate and store embeddings for all tickets
        this.on('embedAllTickets', async (req) => {
            const { db, Tickets } = await getDB();

            const allTickets = await db.run(SELECT.from(Tickets));
            let count = 0;

            for (const ticket of allTickets) {
                const text = `${ticket.ticketSubject} ${ticket.ticketDescription} ${ticket.resolution || ''}`;
                const embedding = await aiService.getEmbedding(text);
                await db.run(UPDATE(Tickets).set({
                    embedding: JSON.stringify(embedding)
                }).where({ ID: ticket.ID }));
                count++;
            }

            req.info(`Successfully embedded ${count} of ${allTickets.length} tickets. AI similarity search is now ready.`);
            return JSON.stringify({ embedded: count, total: allTickets.length });
        });

        await super.init();
    }

    async _findSimilar(ticket, limit = 3) {
        const queryText = `${ticket.ticketSubject} ${ticket.ticketDescription}`;
        const queryEmbedding = await aiService.getEmbedding(queryText);

        const db = await cds.connect.to('db');
        const Tickets = cds.entities('sap.cap.incidents').Tickets;
        const allTickets = await db.run(SELECT.from(Tickets).where({ ID: { '!=': ticket.ID } }));

        const ticketsWithEmbeddings = allTickets.filter(t => t.embedding);

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
            .slice(0, limit);

        return scored;
    }
}

module.exports = { IncidentService };
