// Проверка prod-окружения перед миграциями (сервис migrate в docker-compose.prod.yml).
// Читает реальный process.env контейнера, без dotenv. Печатает имена переменных и причины, значения — никогда.

import { productionEnvSchema } from '@/lib/validations/production-env';

function main(): void {
	const result = productionEnvSchema.safeParse(process.env);
	if (result.success) {
		console.log('check-env: окружение в порядке');
		return;
	}

	console.error('check-env: небезопасное или неполное окружение:');
	for (const issue of result.error.issues) {
		console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
	}
	process.exitCode = 1;
}

main();
