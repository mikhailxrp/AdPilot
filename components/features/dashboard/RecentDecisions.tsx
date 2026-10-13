import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ACTION_LABELS } from '@/lib/agent/action-labels';
import type { RecentDecision } from '@/lib/dashboard/queries';
import { formatRub } from '@/lib/metrics/format';

interface RecentDecisionsProps {
	decisions: RecentDecision[];
}

const NO_VALUE = '—';

function formatChange(before: number | null, after: number | null): string | null {
	if (before === null && after === null) return null;
	return `${before === null ? NO_VALUE : formatRub(before)} → ${after === null ? NO_VALUE : formatRub(after)}`;
}

export function RecentDecisions({ decisions }: RecentDecisionsProps) {
	return (
		<section aria-labelledby="dashboard-decisions" className="space-y-3">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="dashboard-decisions" className="text-lg font-semibold">
					Последние решения
				</h2>
				<Link
					href="/journal"
					className="inline-flex min-h-10 items-center text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
				>
					Весь журнал
				</Link>
			</div>
			{decisions.length === 0 ? (
				<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
					Решений ещё нет.
				</p>
			) : (
				<ul className="divide-y rounded-md border">
					{decisions.map((decision) => {
						const change = formatChange(decision.before, decision.after);
						return (
							<li key={decision.id} className="space-y-1 p-3">
								<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
									<span className="text-sm text-muted-foreground">Тик {decision.tick}</span>
									<Link
										href={`/campaigns/${decision.campaignId}`}
										className="inline-flex min-h-10 items-center font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
									>
										{decision.campaignName}
									</Link>
									<span>{ACTION_LABELS[decision.action]}</span>
									<Badge variant="outline">{decision.engine}</Badge>
									{decision.dryRun && <Badge variant="secondary">dry-run</Badge>}
									{decision.verdict === 'REJECTED' && <Badge variant="destructive">Отклонено</Badge>}
									{change && <span className="whitespace-nowrap text-sm">{change}</span>}
								</div>
								<p className="text-sm text-muted-foreground">{decision.reason}</p>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
