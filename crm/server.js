'use strict';
const { createApp, loadConfig } = require('./src/app');

const config = loadConfig();
const app = createApp(config);
const server = app.listen(config.port, () => {
  console.info(`[crm] Subul XP CRM à l'écoute sur http://localhost:${config.port} (base: ${config.databasePath})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { server.close(() => { app.locals.close(); process.exit(0); }); });
}
