import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { RunStatus } from '@/generated/prisma/client';
import { createRun } from '@/lib/simulator/service';
import { loginSchema } from '@/lib/validations/auth';

const BCRYPT_ROUNDS = 12;
const DEFAULT_RUN_SEED = 42;

async function ensureActiveRun(): Promise<void> {
	const active = await db.simulationRun.findFirst({ where: { status: RunStatus.ACTIVE }, select: { id: true } });
	if (active) {
		console.log('Активный прогон симулятора уже есть');
		return;
	}

	await createRun(DEFAULT_RUN_SEED);
	console.log(`Прогон симулятора создан (seed ${DEFAULT_RUN_SEED})`);
}

async function main(): Promise<void> {
	const parsed = loginSchema.safeParse({
		email: process.env.ADMIN_EMAIL,
		password: process.env.ADMIN_PASSWORD,
	});
	if (!parsed.success) {
		throw new Error('ADMIN_EMAIL (валидный email) и ADMIN_PASSWORD (мин. 8 символов) должны быть заданы в .env');
	}

	const { email, password } = parsed.data;
	const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

	await db.user.upsert({
		where: { email },
		update: { passwordHash },
		create: { email, passwordHash },
	});

	console.log(`Админ ${email} создан/обновлён`);

	await ensureActiveRun();
}

main()
	.catch((error) => {
		console.error('seed failed:', error);
		process.exitCode = 1;
	})
	.finally(() => db.$disconnect());
