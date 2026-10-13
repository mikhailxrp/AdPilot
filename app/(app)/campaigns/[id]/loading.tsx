export default function CampaignLoading() {
	return (
		<div className="space-y-4" role="status" aria-label="Загрузка кампании">
			<div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
			<div className="h-24 w-full animate-pulse rounded-md bg-muted" />
			<div className="h-48 w-full animate-pulse rounded-md bg-muted" />
		</div>
	);
}
