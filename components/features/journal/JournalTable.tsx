import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ACTION_LABELS } from '@/lib/agent/action-labels';
import type { JournalRow } from '@/lib/agent/journal-queries';
import { formatPercent, formatRub } from '@/lib/metrics/format';

interface JournalTableProps {
	rows: JournalRow[];
}

const NO_VALUE = '—';
const countFormatter = new Intl.NumberFormat('ru-RU');
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
/** Сколько символов sha256 показываем как номер версии. */
const PROMPT_HASH_LENGTH = 8;

function formatChange(before: number | null, after: number | null): string {
	if (before === null && after === null) return NO_VALUE;
	return `${before === null ? NO_VALUE : formatRub(before)} → ${after === null ? NO_VALUE : formatRub(after)}`;
}

export function JournalTable({ rows }: JournalTableProps) {
	if (rows.length === 0) {
		return (
			<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
				Записей нет. Сделайте тик на странице «Симулятор» или смените фильтры.
			</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Тик</TableHead>
					<TableHead>Кампания</TableHead>
					<TableHead>Действие</TableHead>
					<TableHead>Было → стало</TableHead>
					<TableHead>Причина</TableHead>
					<TableHead>rules решил бы</TableHead>
					<TableHead>Метрики</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => (
					<TableRow key={row.id}>
						<TableCell>{row.tick}</TableCell>
						<TableCell className="font-medium">{row.campaignName}</TableCell>
						<TableCell>
							<div className="flex flex-wrap items-center gap-1">
								<span>{ACTION_LABELS[row.action]}</span>
								<Badge variant="outline">{row.engine}</Badge>
								{row.dryRun && <Badge variant="secondary">dry-run</Badge>}
								{row.verdict === 'REJECTED' && <Badge variant="destructive">Отклонено</Badge>}
							</div>
						</TableCell>
						<TableCell className="whitespace-nowrap">{formatChange(row.before, row.after)}</TableCell>
						<TableCell className="max-w-md whitespace-normal">
							<p>{row.reason}</p>
							{row.rejectReason && (
								<p className="text-sm text-destructive">Причина отказа: {row.rejectReason}</p>
							)}
							{row.applyError && (
								<p className="text-sm text-destructive">Ошибка применения: {row.applyError}</p>
							)}
							{row.rawResponse && (
								<details className="mt-1">
									<summary className="cursor-pointer text-sm">Ответ модели</summary>
									<pre className="mt-2 max-h-60 overflow-auto rounded-md bg-muted p-2 text-xs break-all whitespace-pre-wrap">
										{row.rawResponse}
									</pre>
								</details>
							)}
							{row.promptVersion && (
								<details className="mt-1">
									<summary className="cursor-pointer text-sm">
										Версия промпта {row.promptVersion.sha256.slice(0, PROMPT_HASH_LENGTH)} ·{' '}
										{dateFormatter.format(row.promptVersion.createdAt)}
									</summary>
									<pre className="mt-2 max-h-60 overflow-auto rounded-md bg-muted p-2 text-xs break-words whitespace-pre-wrap">
										{row.promptVersion.text}
									</pre>
								</details>
							)}
						</TableCell>
						<TableCell className="max-w-xs whitespace-normal">
							{row.shadowAction ? (
								<div className="space-y-1">
									<div className="flex flex-wrap items-center gap-1">
										<span>{ACTION_LABELS[row.shadowAction]}</span>
										{row.shadowAfter !== null && (
											<span className="whitespace-nowrap">→ {formatRub(row.shadowAfter)}</span>
										)}
										{row.shadowAction !== row.action && <Badge variant="secondary">Разошлись</Badge>}
									</div>
									{row.shadowReason && (
										<p className="text-sm text-muted-foreground">{row.shadowReason}</p>
									)}
								</div>
							) : (
								<span className="text-sm text-muted-foreground">{NO_VALUE}</span>
							)}
						</TableCell>
						<TableCell>
							{row.metrics ? (
								<details>
									<summary className="cursor-pointer text-sm">Показать</summary>
									<dl className="mt-2 grid grid-cols-[auto_auto] gap-x-3 text-sm whitespace-nowrap">
										<dt>Окно</dt>
										<dd>{row.metrics.windowTicks} тиков</dd>
										<dt>Показы</dt>
										<dd>{countFormatter.format(row.metrics.window.impressions)}</dd>
										<dt>Клики</dt>
										<dd>{countFormatter.format(row.metrics.window.clicks)}</dd>
										<dt>Заказы</dt>
										<dd>{countFormatter.format(row.metrics.window.orders)}</dd>
										<dt>Расход</dt>
										<dd>{formatRub(row.metrics.window.cost)}</dd>
										<dt>CPC</dt>
										<dd>{formatRub(row.metrics.metrics.cpc)}</dd>
										<dt>CTR</dt>
										<dd>{formatPercent(row.metrics.metrics.ctr)}</dd>
										<dt>CR</dt>
										<dd>{formatPercent(row.metrics.metrics.cr)}</dd>
										<dt>CPO</dt>
										<dd>{formatRub(row.metrics.metrics.cpo)}</dd>
										<dt>Расход за сутки</dt>
										<dd>{formatRub(row.metrics.daySpend)}</dd>
									</dl>
								</details>
							) : (
								<span className="text-sm text-muted-foreground">{NO_VALUE}</span>
							)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
