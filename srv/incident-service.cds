using { sap.cap.incidents as my } from '../db/schema';

service IncidentService @(path: '/incident') {
    
    entity Tickets as projection on my.Tickets
        excluding { embedding };

    // AI Actions
    action categorizeTicket(ticketID: Integer) returns String;
    action generateResponse(ticketID: Integer) returns String;
    action findSimilarTickets(ticketID: Integer) returns String;
    action embedAllTickets(offset: Integer, limit: Integer) returns String;
}