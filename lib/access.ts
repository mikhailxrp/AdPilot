import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export interface AdminUser {
	id: string;
	email: string;
}

// Админ один: «залогинен» = admin. Вызывать в страницах, Server Actions и Route Handlers.
export async function requireAdmin(): Promise<AdminUser> {
	const session = await auth();
	const user = session?.user;

	if (!user?.id || !user.email) {
		redirect('/login');
	}

	return { id: user.id, email: user.email };
}
