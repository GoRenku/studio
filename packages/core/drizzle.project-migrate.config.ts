import { defineConfig } from 'drizzle-kit';

const databasePath = process.env.RENKU_PROJECT_DATABASE_PATH;

if (!databasePath) {
  throw new Error('RENKU_PROJECT_DATABASE_PATH is required.');
}

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: databasePath,
  },
});
