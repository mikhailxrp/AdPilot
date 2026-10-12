import { Suspense } from 'react';
import { AdminNav } from '@/components/layouts/AdminNav';
import { AdminHeader } from '@/components/layouts/AdminHeader';

export default function AppLayout({ children }: LayoutProps<'/'>) {
	return (
		<div className="flex flex-1 flex-col">
			<header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
				<span className="font-heading text-lg">AdPilot</span>
				<AdminNav />
				<Suspense fallback={null}>
					<AdminHeader />
				</Suspense>
			</header>
			<main className="flex-1 p-4">{children}</main>
		</div>
	);
}
