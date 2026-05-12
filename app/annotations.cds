using IncidentService as service from '../srv/incident-service';

// List Report Page annotations
annotate service.Tickets with @(
    UI: {
        // Header info for Object Page
        HeaderInfo: {
            TypeName: 'Incident',
            TypeNamePlural: 'Incidents',
            Title: { Value: ticketSubject },
            Description: { Value: customerName }
        },

        // Selection fields (filters) on List Report
        SelectionFields: [
            ticketPriority,
            ticketStatus,
            ticketType,
            productPurchased
        ],

        // Columns in the table
        LineItem: [
            { Value: ticketSubject, Label: 'Subject' },
            { Value: customerName, Label: 'Customer' },
            { Value: productPurchased, Label: 'Product' },
            { Value: ticketType, Label: 'Type' },
            { Value: ticketPriority, Label: 'Priority' },
            { Value: ticketStatus, Label: 'Status' },
            { Value: aiUrgency, Label: 'AI Urgency' }
        ],

        // Object Page facets
        Facets: [
            {
                $Type: 'UI.ReferenceFacet',
                Label: 'Ticket Details',
                Target: '@UI.FieldGroup#TicketDetails'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Label: 'Customer Info',
                Target: '@UI.FieldGroup#CustomerInfo'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Label: 'AI Analysis',
                Target: '@UI.FieldGroup#AIAnalysis'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Label: 'Resolution',
                Target: '@UI.FieldGroup#Resolution'
            }
        ],

        FieldGroup#TicketDetails: {
            Label: 'Ticket Details',
            Data: [
                { Value: ticketSubject, Label: 'Subject' },
                { Value: ticketDescription, Label: 'Description' },
                { Value: ticketType, Label: 'Type' },
                { Value: ticketChannel, Label: 'Channel' },
                { Value: ticketStatus, Label: 'Status' },
                { Value: ticketPriority, Label: 'Priority' },
                { Value: productPurchased, Label: 'Product' },
                { Value: dateOfPurchase, Label: 'Purchase Date' }
            ]
        },

        FieldGroup#CustomerInfo: {
            Label: 'Customer Information',
            Data: [
                { Value: customerName, Label: 'Name' },
                { Value: customerEmail, Label: 'Email' },
                { Value: customerAge, Label: 'Age' },
                { Value: customerGender, Label: 'Gender' }
            ]
        },

        FieldGroup#AIAnalysis: {
            Label: 'AI Analysis',
            Data: [
                { Value: aiCategory, Label: 'AI Category' },
                { Value: aiUrgency, Label: 'AI Urgency' },
                { Value: aiSummary, Label: 'AI Summary' },
                { Value: suggestedResponse, Label: 'Suggested Response' }
            ]
        },

        FieldGroup#Resolution: {
            Label: 'Resolution',
            Data: [
                { Value: resolution, Label: 'Resolution' },
                { Value: firstResponseTime, Label: 'First Response' },
                { Value: timeToResolution, Label: 'Time to Resolution' },
                { Value: customerSatisfaction, Label: 'Satisfaction Rating' }
            ]
        }
    }
);
