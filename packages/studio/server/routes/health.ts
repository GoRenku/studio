import { Hono } from 'hono';

const health = new Hono().get('/', (c) => c.json({ ok: true }));

export default health;
export type HealthRoute = typeof health;
