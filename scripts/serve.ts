import { serveDist } from './server.ts';

const server = await serveDist(4322);
console.log(`Static test server: ${server.url}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.close().then(() => process.exit(0)); });
