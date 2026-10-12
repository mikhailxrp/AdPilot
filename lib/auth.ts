import bcrypt from 'bcryptjs';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { loginSchema } from '@/lib/validations/auth';

const LOGIN_PATH = '/login';

export const { handlers, auth, signIn, signOut } = NextAuth({
	session: { strategy: 'jwt' },
	pages: { signIn: LOGIN_PATH },
	providers: [
		Credentials({
			credentials: {
				email: {},
				password: {},
			},
			authorize: async (credentials) => {
				const parsed = loginSchema.safeParse(credentials);
				if (!parsed.success) return null;

				try {
					const user = await db.user.findUnique({ where: { email: parsed.data.email } });
					if (!user) return null;

					const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
					if (!isValid) return null;

					return { id: user.id, email: user.email };
				} catch (error) {
					console.error('authorize failed:', error);
					return null;
				}
			},
		}),
	],
	callbacks: {
		// Быстрый редирект: гость видит только /login. Реальная проверка — requireAdmin().
		authorized: ({ auth: session, request: { nextUrl } }) => {
			if (nextUrl.pathname === LOGIN_PATH) return true;
			return !!session?.user;
		},
		session: ({ session, token }) => {
			if (token.sub) session.user.id = token.sub;
			return session;
		},
	},
});
