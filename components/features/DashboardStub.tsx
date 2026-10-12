import { requireAdmin } from '@/lib/access';

export async function DashboardStub() {
	await requireAdmin();

	return (
		<section>
			<h1 className="text-2xl font-bold">Дашборд</h1>
			<p className="mt-2 text-muted-foreground">Здесь появятся кампании и решения агента.</p>
		</section>
	);
}
