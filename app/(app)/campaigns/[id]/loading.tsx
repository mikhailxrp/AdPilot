const CHART_SKELETONS = ['bid', 'cost', 'cpo'] as const;

export default function CampaignLoading() {
	return (
		<div className="space-y-4" role="status" aria-label="Загрузка кампании">
			<div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
			<div className="h-24 w-full animate-pulse rounded-md bg-muted" />
			<div className="grid gap-4 lg:grid-cols-3">
				{CHART_SKELETONS.map((key) => (
					<div key={key} className="h-72 animate-pulse rounded-lg bg-muted" />
				))}
			</div>
			<div className="h-48 w-full animate-pulse rounded-md bg-muted" />
		</div>
	);
}
