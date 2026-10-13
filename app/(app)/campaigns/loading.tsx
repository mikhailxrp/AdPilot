export default function CampaignsLoading() {
	return (
		<div className="space-y-4" role="status" aria-label="Загрузка кампаний">
			<div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
			<div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
			<div className="h-48 w-full animate-pulse rounded-md bg-muted" />
		</div>
	);
}
