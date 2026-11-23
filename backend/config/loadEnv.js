/**
 * Loads .env and refuses to start the server if the configuration is unsafe.
 *
 * This must stay the first import in server.js. ES modules run their imports in
 * order, so exiting here stops Passport, the database connection and every
 * other module from running with missing or weak configuration.
 */
import 'dotenv/config';
import { validateEnv, formatConfigErrors } from './env.js';

const { errors, warnings } = validateEnv(process.env);

if (errors.length > 0) {
    console.error(formatConfigErrors(errors));
    process.exit(1);
}

for (const warning of warnings) {
    console.warn(`Configuration warning: ${warning}`);
}
