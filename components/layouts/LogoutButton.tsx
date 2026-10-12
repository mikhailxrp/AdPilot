'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
	const handleClick = async () => {
		try {
			await signOut({ redirectTo: '/login' });
		} catch (error) {
			console.error('signOut failed:', error);
		}
	};

	return (
		<Button type="button" variant="outline" onClick={handleClick}>
			Выйти
		</Button>
	);
}
