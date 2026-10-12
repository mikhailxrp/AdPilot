import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { loginSchema } from '@/lib/validations/auth';

const BCRYPT_ROUNDS = 12;

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
}

main()
	.catch((error) => {
		console.error('seed failed:', error);
		process.exitCode = 1;
	})
	.finally(() => db.$disconnect());
