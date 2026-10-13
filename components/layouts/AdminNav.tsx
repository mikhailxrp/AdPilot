'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
	{ href: '/dashboard', label: 'Дашборд' },
	{ href: '/campaigns', label: 'Кампании' },
	{ href: '/simulator', label: 'Симулятор' },
	{ href: '/journal', label: 'Журнал' },
	{ href: '/settings', label: 'Настройки' },
] as const;

// Раздел активен и на вложенных страницах: /campaigns/[id] подсвечивает «Кампании»
function isSectionActive(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
	const pathname = usePathname();

	return (
		<nav aria-label="Основная навигация">
			<ul className="flex flex-wrap items-center gap-1">
				{NAV_ITEMS.map(({ href, label }) => {
					const isActive = isSectionActive(pathname, href);

					return (
						<li key={href}>
							<Link
								href={href}
								aria-current={isActive ? 'page' : undefined}
								className={cn(
									'inline-flex min-h-10 items-center rounded-md px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
									isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground',
								)}
							>
								{label}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
