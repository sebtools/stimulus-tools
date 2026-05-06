// ...existing code...
// Simple mock data bridge/store for demos — responds to record:ui:load and record:ui:query
const MOCK_DATA = [
    { id: 'person_123', table: 'people', name: 'Charlie', email: 'charlie@example.org', notes: 'Loaded for row demo' },
    { id: 'person_456', table: 'people', name: 'Dana', email: 'dana@example.org', notes: 'Existing row' },
    { id: 'person_1',   table: 'people', name: 'Alice',  email: 'alice@example.org' },
    { id: 'person_2',   table: 'people', name: 'Bob',    email: 'bob@example.org' }
];

function matchesFilter(record, filter = {}) {
    for (const key of Object.keys(filter)) {
        const v = filter[key];
        if (record[key] === undefined) return false;
        if (String(record[key]) !== String(v)) return false;
    }
    return true;
}

function normalizeTable(table) {
    if (!table) return table;
    if (typeof table === 'string') return table;
    if (table && typeof table.getAttribute === 'function') {
        return table.getAttribute('data-record-table') || null;
    }
    return null;
}

document.addEventListener('record:ui:load', (event) => {
    const { channel, table, id, origin } = event.detail || {};
    const tableName = normalizeTable(table);
    setTimeout(() => {
        const record = MOCK_DATA.find(r => r.table === tableName && r.id === id) || null;
        document.dispatchEvent(new CustomEvent('record:data:load', {
            detail: { channel, table: tableName, record, origin },
            bubbles: true
        }));
    }, 250);
});

document.addEventListener('record:ui:query', (event) => {
    const { channel, table, filter = {}, origin } = event.detail || {};
    const tableName = normalizeTable(table);
	console.log('tableName', tableName, 'filter', filter);
    setTimeout(() => {
        const records = MOCK_DATA.filter(r => r.table === tableName && matchesFilter(r, filter));
		console.log('Query matches', records);
		console.log('MOCK_DATA', MOCK_DATA);
        document.dispatchEvent(new CustomEvent('record:data:load', {
            detail: { channel, table: tableName, records, origin },
            bubbles: true
        }));
    }, 300);
});

document.addEventListener('record:ui:update', (event) => {
    // no-op for demo; could mutate MOCK_DATA and emit record:data:update
});
// ...existing code...