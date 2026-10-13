import Link from 'next/link';

export default function CampaignNotFound() {
	return (
		<section className="space-y-3">
			<h1 className="text-2xl font-bold">Кампания не найдена</h1>
			<p className="text-muted-foreground">
				Такой кампании нет.{' '}
				<Link href="/campaigns" className="text-foreground underline underline-offset-4">
					Вернуться к списку кампаний
				</Link>
				.
			</p>
		</section>
	);
}
