'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACTION_LABELS } from '@/lib/agent/action-labels';
import type { JournalCampaign } from '@/lib/agent/journal-queries';
import { DECISION_ACTIONS } from '@/lib/agent/types';
import { AGENT_ENGINES } from '@/lib/validations/agent-config';
import { buildJournalHref, type JournalFilters as Filters } from '@/lib/validations/journal';

interface JournalFiltersProps {
	campaigns: JournalCampaign[];
	filters: Omit<Filters, 'page'>;
}

type FilterKey = 'campaign' | 'action' | 'engine';

interface FilterItem {
	value: string;
	label: string;
}

const ALL = 'all';

export function JournalFilters({ campaigns, filters }: JournalFiltersProps) {
	const router = useRouter();

	const campaignItems: FilterItem[] = [
		{ value: ALL, label: 'Все кампании' },
		...campaigns.map(({ id, name }) => ({ value: id, label: name })),
	];
	const actionItems: FilterItem[] = [
		{ value: ALL, label: 'Все действия' },
		...DECISION_ACTIONS.map((action) => ({ value: action, label: ACTION_LABELS[action] })),
	];
	const engineItems: FilterItem[] = [
		{ value: ALL, label: 'Все движки' },
		...AGENT_ENGINES.map((engine) => ({ value: engine, label: engine })),
	];

	const handleChange = (key: FilterKey, value: string | null) => {
		const next = { ...filters, [key]: value === null || value === ALL ? undefined : value };
		router.replace(buildJournalHref(next, 1));
	};

	const renderSelect = (key: FilterKey, label: string, items: FilterItem[], current: string | undefined) => (
		<Select items={items} value={current ?? ALL} onValueChange={(value) => handleChange(key, value)}>
			<SelectTrigger aria-label={label} className="min-h-10 min-w-44">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{items.map(({ value, label: itemLabel }) => (
					<SelectItem key={value} value={value}>
						{itemLabel}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);

	return (
		<div className="flex flex-wrap gap-3">
			{renderSelect('campaign', 'Кампания', campaignItems, filters.campaign)}
			{renderSelect('action', 'Действие', actionItems, filters.action)}
			{renderSelect('engine', 'Движок', engineItems, filters.engine)}
		</div>
	);
}
