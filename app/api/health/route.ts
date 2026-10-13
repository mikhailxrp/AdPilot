import { connection } from 'next/server';
import { checkHealth } from '@/lib/health';

// БД импортируется внутри пинга: без DATABASE_URL `lib/db` бросает при импорте, и это должно стать 503, а не 500
async function pingDatabase(): Promise<unknown> {
	const { db } = await import('@/lib/db');
	return db.$queryRaw`SELECT 1`;
}

// Публичный: отдаёт только ok / error. Healthcheck контейнера web и Traefik.
export async function GET(): Promise<Response> {
	// Cache Components: без этого хендлер мог бы отрендериться при сборке и застыть на «ok»
	await connection();

	const result = await checkHealth(pingDatabase);

	return Response.json(result, {
		status: result.status === 'ok' ? 200 : 503,
		headers: { 'Cache-Control': 'no-store' },
	});
}
