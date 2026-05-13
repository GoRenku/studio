import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/schema/index.ts',
  out: './drizzle',
});
