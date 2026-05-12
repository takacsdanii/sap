namespace sap.cap.incidents;

using { managed } from '@sap/cds/common';

entity Tickets : managed {
    key ID               : Integer;
    customerName         : String(100);
    customerEmail        : String(100);
    customerAge          : Integer;
    customerGender       : String(20);
    productPurchased     : String(100);
    dateOfPurchase       : Date;
    ticketType           : String(50);
    ticketSubject        : String(255);
    ticketDescription    : String(5000);
    ticketStatus         : String(50);
    resolution           : String(5000);
    ticketPriority       : String(20);
    ticketChannel        : String(50);
    firstResponseTime    : DateTime;
    timeToResolution     : DateTime;
    customerSatisfaction : Integer;

    // AI-generated fields
    aiSummary            : String(1000);
    aiCategory           : String(50);
    aiUrgency            : String(20);
    suggestedResponse    : String(5000);
    
    // Vector embedding for RAG (stored as JSON string for SQLite compatibility)
    embedding            : LargeString;
}