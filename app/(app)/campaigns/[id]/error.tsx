'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function CampaignError({
	error,
	unstable_retry,
}: {
	error: Error & { digest?: string };
	unstable_retry: () => void;
}) {
	useEffect(() => {
		console.error('campaign page failed:', error);
	}, [error]);

	return (
		<div role="alert" className="space-y-3">
			<h2 className="text-lg font-semibold">Не удалось загрузить кампанию</h2>
			<Button type="button" onClick={() => unstable_retry()}>
				Попробовать снова
			</Button>
		</div>
	);
}
