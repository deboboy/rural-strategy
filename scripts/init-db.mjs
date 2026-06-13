import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from '@neondatabase/serverless';

const root = process.cwd();
const schemaPath = join(root, 'db', 'schema.sql');
const schema = readFileSync(schemaPath, 'utf8');
const connectionString = process.env.POSTGRES_URL?.trim();

if (!connectionString) {
  throw new Error('POSTGRES_URL is not configured');
}

const pool = new Pool({ connectionString });
await pool.query(schema);
await pool.end();

console.log('Database schema applied.');
