'use client';

import { useState, useTransition } from 'react';
import { setEngineAction } from '@/actions/simulator';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AGENT_ENGINES, type EngineToggleInput } from '@/lib/validations/agent-config';

type Engine = EngineToggleInput['engine'];

interface EngineToggleProps {
	engine: Engine;
}

const LEGEND = 'Движок агента';
const UNEXPECTED_ERROR_MESSAGE = 'Не удалось выполнить операцию. Попробуйте ещё раз';
const ENGINE_LABELS: Record<Engine, string> = { RULES: 'Правила', LLM: 'LLM' };

function isEngine(value: unknown): value is Engine {
	return AGENT_ENGINES.some((engine) => engine === value);
}

export function EngineToggle({ engine }: EngineToggleProps) {
	const [current, setCurrent] = useState<Engine>(engine);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const handleChange = (value: unknown) => {
		if (!isEngine(value) || value === current) return;
		setError(null);
		startTransition(async () => {
			try {
				const result = await setEngineAction({ engine: value });
				if (result.success) setCurrent(value);
				else setError(result.error ?? UNEXPECTED_ERROR_MESSAGE);
			} catch (actionError) {
				console.error('setEngineAction failed:', actionError);
				setError(UNEXPECTED_ERROR_MESSAGE);
			}
		});
	};

	return (
		<FieldSet className="w-auto space-y-2">
			<FieldLegend variant="label">{LEGEND}</FieldLegend>
			<RadioGroup
				aria-label={LEGEND}
				value={current}
				onValueChange={handleChange}
				disabled={isPending}
				className="flex gap-4"
			>
				{AGENT_ENGINES.map((option) => (
					<Field key={option} orientation="horizontal" className="w-auto">
						<RadioGroupItem value={option} id={`agent-engine-${option}`} />
						<FieldLabel htmlFor={`agent-engine-${option}`} className="font-normal">
							{ENGINE_LABELS[option]}
						</FieldLabel>
					</Field>
				))}
			</RadioGroup>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
		</FieldSet>
	);
}
