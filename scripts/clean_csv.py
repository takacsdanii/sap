import csv

# Read original CSV properly handling multi-line fields  
rows = []
with open('db/data/sap.cap.incidents-Tickets.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader):
        if i >= 50:
            break
        rows.append(row)

# Write clean CSV (single-line descriptions, replace newlines with spaces)
with open('db/data/sap.cap.incidents-Tickets.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    for row in rows:
        # Clean multi-line fields
        row['ticketDescription'] = row['ticketDescription'].replace('\n', ' ').replace('\r', ' ').strip()
        if row['resolution']:
            row['resolution'] = row['resolution'].replace('\n', ' ').replace('\r', ' ').strip()
        writer.writerow(row)

print(f"Written {len(rows)} clean rows")
