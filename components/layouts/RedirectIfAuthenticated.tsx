import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

interface RedirectIfAuthenticatedProps {
	to: string;
}

// Читает сессию (запрос), поэтому рендерится внутри <Suspense>.
export async function RedirectIfAuthenticated({ to }: RedirectIfAuthenticatedProps): Promise<null> {
	await connection();
	const session = await auth();
	if (session?.user) redirect(to);

	return null;
}
