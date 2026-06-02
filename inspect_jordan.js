const { all, initDatabase } = require('./db');

async function inspect() {
    await initDatabase();
    const rows = await all("SELECT * FROM renewals WHERE client_name LIKE '%Jordan%' OR client_id = (SELECT id FROM clients WHERE name LIKE '%Jordan%' LIMIT 1)");
    console.log(JSON.stringify(rows, null, 2));
}

inspect().catch(console.error);
