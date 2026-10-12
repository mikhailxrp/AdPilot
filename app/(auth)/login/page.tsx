import { Suspense } from 'react';
import { LoginForm } from '@/components/forms/LoginForm';
import { RedirectIfAuthenticated } from '@/components/layouts/RedirectIfAuthenticated';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
	return (
		<main className="flex flex-1 items-center justify-center p-4">
			<Suspense fallback={null}>
				<RedirectIfAuthenticated to="/dashboard" />
			</Suspense>
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Вход в AdPilot</CardTitle>
				</CardHeader>
				<CardContent>
					<LoginForm />
				</CardContent>
			</Card>
		</main>
	);
}
