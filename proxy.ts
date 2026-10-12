// Быстрый редирект гостей на /login; защитой не является — доступ проверяет requireAdmin()
export { auth as proxy } from '@/lib/auth';

export const config = {
	matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
