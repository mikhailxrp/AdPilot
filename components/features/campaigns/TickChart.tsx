'use client';

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { SeriesPoint } from '@/lib/campaigns/series';
import { formatRub } from '@/lib/metrics/format';
import { cn } from '@/lib/utils';

export type SeriesKey = Exclude<keyof SeriesPoint, 'tick'>;
export type ReferenceTone = 'muted' | 'danger';

export interface ChartReference {
	label: string;
	/** Копейки. */
	value: number;
	tone: ReferenceTone;
}

interface TickChartProps {
	title: string;
	dataKey: SeriesKey;
	points: SeriesPoint[];
	references?: ChartReference[];
	note?: string;
}

/** До стольких точек рисуем маркеры: на коротком ряду линия из одной точки иначе не видна. */
const MAX_POINTS_WITH_DOTS = 48;
const DOT_RADIUS = 2;
const Y_AXIS_WIDTH = 80;
const REFERENCE_DASH = '4 4';

const REFERENCE_STROKE: Record<ReferenceTone, string> = {
	muted: 'var(--muted-foreground)',
	danger: 'var(--destructive)',
};

const REFERENCE_SWATCH: Record<ReferenceTone, string> = {
	muted: 'border-muted-foreground',
	danger: 'border-destructive',
};

export function TickChart({ title, dataKey, points, references = [], note }: TickChartProps) {
	const config = {
		[dataKey]: { label: title, color: 'var(--foreground)' },
	} satisfies ChartConfig;

	return (
		<figure className="space-y-3 rounded-lg border p-4">
			<figcaption className="font-semibold">{title}</figcaption>
			<ChartContainer
				config={config}
				role="img"
				aria-label={`${title}: график по тикам 1–${points.length}`}
				className="aspect-auto h-56 w-full"
			>
				<LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
					<CartesianGrid vertical={false} />
					<XAxis dataKey="tick" tickLine={false} axisLine={false} minTickGap={16} />
					<YAxis
						width={Y_AXIS_WIDTH}
						tickLine={false}
						axisLine={false}
						tickFormatter={(value: number) => formatRub(value)}
					/>
					<ChartTooltip
						content={
							<ChartTooltipContent
								labelFormatter={(_, payload) => `Тик ${payload[0]?.payload?.tick ?? ''}`}
								formatter={(value) => (
									<span className="font-mono tabular-nums">
										{formatRub(typeof value === 'number' ? value : null)}
									</span>
								)}
							/>
						}
					/>
					{references.map((reference) => (
						<ReferenceLine
							key={reference.label}
							y={reference.value}
							stroke={REFERENCE_STROKE[reference.tone]}
							strokeDasharray={REFERENCE_DASH}
							ifOverflow="extendDomain"
						/>
					))}
					<Line
						dataKey={dataKey}
						type="linear"
						stroke={`var(--color-${dataKey})`}
						strokeWidth={2}
						dot={points.length <= MAX_POINTS_WITH_DOTS ? { r: DOT_RADIUS } : false}
						connectNulls={false}
						isAnimationActive={false}
					/>
				</LineChart>
			</ChartContainer>
			{references.length > 0 && (
				<ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
					{references.map((reference) => (
						<li key={reference.label} className="flex items-center gap-2">
							<span
								aria-hidden="true"
								className={cn('w-4 border-t-2 border-dashed', REFERENCE_SWATCH[reference.tone])}
							/>
							{reference.label}: {formatRub(reference.value)}
						</li>
					))}
				</ul>
			)}
			{note && <p className="text-sm text-muted-foreground">{note}</p>}
		</figure>
	);
}
