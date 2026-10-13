import { expect, test } from '@playwright/test';

test('GET /api/health открыт гостю и отдаёт ok без редиректа', async ({ request }) => {
	const response = await request.get('/api/health', { maxRedirects: 0 });

	expect(response.status()).toBe(200);
	expect(response.headers()['cache-control']).toContain('no-store');
	expect(await response.json()).toEqual({ status: 'ok' });
});
