import Link from 'next/link';
import { CampaignCpoTable } from '@/components/features/dashboard/CampaignCpoTable';
import { RecentDecisions } from '@/components/features/dashboard/RecentDecisions';
import { SummaryCards } from '@/components/features/dashboard/SummaryCards';
import { requireAdmin } from '@/lib/access';
import { getAgentConfig } from '@/lib/agent/config';
import { getDashboardView } from '@/lib/dashboard/queries';
import { buildDashboardSummary } from '@/lib/dashboard/summary';

export default async function DashboardPage() {
	await requireAdmin();
	const [view, config] = await Promise.all([getDashboardView(), getAgentConfig()]);

	if (!view) {
		return (
			<section className="space-y-6">
				<h1 className="text-2xl font-bold">Дашборд</h1>
				<p className="text-muted-foreground">
					Прогона нет —{' '}
					<Link href="/simulator" className="text-foreground underline underline-offset-4">
						сбросьте симулятор с seed
					</Link>
					.
				</p>
			</section>
		);
	}

	const { run, recentDecisions } = view;
	const summary = buildDashboardSummary(run.campaigns, config.cpoTolerancePct);

	return (
		<section className="space-y-8">
			<div className="space-y-1">
				<h1 className="text-2xl font-bold">Дашборд</h1>
				<p className="text-muted-foreground">
					Тик {run.currentTick} · seed {run.seed}
				</p>
			</div>
			<SummaryCards totals={summary.totals} />
			<CampaignCpoTable campaigns={summary.campaigns} />
			<RecentDecisions decisions={recentDecisions} />
		</section>
	);
}
