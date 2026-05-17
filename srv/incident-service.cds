using { sap.cap.incidents as my } from '../db/schema';

service IncidentService @(path: '/incident') {

    entity Tickets as projection on my.Tickets
        excluding { embedding }
        actions {
            // Bound actions — act on the currently selected/viewed ticket
            action categorizeTicket()   returns String;
            action generateResponse()   returns String;
            action findSimilarTickets() returns String;
        };

    // Unbound batch action — embeds ALL tickets at once
    action embedAllTickets() returns String;
}