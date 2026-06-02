const { all, initDatabase } = require('./db');

async function inspect() {
    await initDatabase();
    const rows = await all("SELECT * FROM renewals WHERE client_name LIKE '%Arion%' OR client_id = 152");
    console.log(JSON.stringify(rows, null, 2));
}

inspect().catch(console.error);
