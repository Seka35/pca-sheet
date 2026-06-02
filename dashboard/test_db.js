const { all } = require('./lib/db');
(async () => {
  const clients = await all("SELECT id, name FROM clients WHERE name LIKE '%Cyrus vakil%'");
  console.log("Clients:", clients);
  if (clients.length > 0) {
    const clientId = clients[0].id;
    const renewals = await all(`SELECT sr_no, month, tier, setup_type, amount_received FROM renewals WHERE client_id = ?`, [clientId]);
    console.log("Renewals:", renewals);
  }
})();
