import Link from 'next/link';
import { CampaignsList } from '@/components/features/campaigns/CampaignsList';
import { requireAdmin } from '@/lib/access';
import { getActiveRunView } from '@/lib/simulator/queries';

export default async function CampaignsPage() {
	await requireAdmin();
	const run = await getActiveRunView();

	return (
		<section className="space-y-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-bold">Кампании</h1>
				{run && (
					<p className="text-muted-foreground">
						Тик {run.currentTick} · seed {run.seed}
					</p>
				)}
			</div>
			{run ? (
				<CampaignsList campaigns={run.campaigns} />
			) : (
				<p className="text-muted-foreground">
					Прогона нет —{' '}
					<Link href="/simulator" className="text-foreground underline underline-offset-4">
						сбросьте симулятор с seed
					</Link>
					.
				</p>
			)}
		</section>
	);
}
