'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
	error,
	unstable_retry,
}: {
	error: Error & { digest?: string };
	unstable_retry: () => void;
}) {
	useEffect(() => {
		console.error('dashboard page failed:', error);
	}, [error]);

	return (
		<div role="alert" className="space-y-3">
			<h2 className="text-lg font-semibold">Не удалось загрузить дашборд</h2>
			<Button type="button" onClick={() => unstable_retry()}>
				Попробовать снова
			</Button>
		</div>
	);
}
