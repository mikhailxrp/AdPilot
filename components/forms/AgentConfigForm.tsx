'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateAgentConfigAction } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { AGENT_ENGINES, type AgentConfigBaseInput, type AgentConfigInput } from '@/lib/validations/agent-config';
import {
	agentConfigFormSchema,
	toAgentConfigFormValues,
	type AgentConfigFormValues,
} from '@/lib/validations/agent-config-form';

type Engine = AgentConfigInput['engine'];
type TextFieldName = Exclude<keyof AgentConfigFormValues, 'engine' | 'dryRun' | 'timerEnabled'>;
type SwitchFieldName = 'dryRun' | 'timerEnabled';

interface AgentConfigFormProps {
	config: AgentConfigInput;
}

interface TextFieldMeta {
	name: TextFieldName;
	label: string;
	description: string;
	inputMode: 'numeric' | 'decimal';
}

interface SwitchFieldMeta {
	name: SwitchFieldName;
	label: string;
	description: string;
}

const ENGINE_LEGEND = 'Движок агента';
const ENGINE_LABELS: Record<Engine, string> = { RULES: 'Правила', LLM: 'LLM' };
const SAVED_MESSAGE = 'Сохранено';
const UNEXPECTED_ERROR_MESSAGE = 'Не удалось сохранить настройки. Попробуйте ещё раз';

const SWITCH_FIELDS: readonly SwitchFieldMeta[] = [
	{ name: 'dryRun', label: 'Dry-run', description: 'Решения пишутся в журнал, но ставки и бюджеты не меняются' },
	{ name: 'timerEnabled', label: 'Таймер агента', description: 'Worker сам запускает тик с заданным интервалом' },
];

const TIMER_FIELDS: readonly TextFieldMeta[] = [
	{ name: 'tickIntervalSec', label: 'Интервал таймера, сек', description: 'Пауза между тиками worker-а', inputMode: 'numeric' },
];

const THRESHOLD_FIELDS: readonly TextFieldMeta[] = [
	{ name: 'minClicks', label: 'Минимум кликов', description: 'Меньше кликов в окне — агент ждёт данных', inputMode: 'numeric' },
	{ name: 'windowTicks', label: 'Окно статистики, тиков', description: 'За сколько последних тиков считаются метрики', inputMode: 'numeric' },
	{ name: 'cpoTolerancePct', label: 'Допуск CPO, %', description: '20 — допустимый CPO до цели × 1,2', inputMode: 'numeric' },
	{ name: 'cooldownTicks', label: 'Пауза между изменениями, тиков', description: 'Сколько тиков не трогать кампанию после изменения', inputMode: 'numeric' },
];

const LIMIT_FIELDS: readonly TextFieldMeta[] = [
	{ name: 'maxStepPct', label: 'Максимальный шаг, %', description: 'Насколько за раз можно изменить ставку или бюджет', inputMode: 'numeric' },
	{ name: 'maxDailyBudget', label: 'Лимит дневного бюджета, ₽', description: 'Выше агент бюджет не поднимет', inputMode: 'decimal' },
];

function isEngine(value: unknown): value is Engine {
	return AGENT_ENGINES.some((engine) => engine === value);
}

export function AgentConfigForm({ config }: AgentConfigFormProps) {
	const [status, setStatus] = useState<'saved' | null>(null);
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm<AgentConfigFormValues, unknown, AgentConfigBaseInput>({
		resolver: zodResolver(agentConfigFormSchema),
		defaultValues: toAgentConfigFormValues(config),
	});
	const isSaving = form.formState.isSubmitting;

	// В action уходят значения формы (строки, рубли), а не результат схемы: сервер проверяет их той же схемой
	const onSubmit = async () => {
		setStatus(null);
		setServerError(null);
		try {
			const result = await updateAgentConfigAction(form.getValues());
			if (result.success && result.data) {
				form.reset(toAgentConfigFormValues(result.data));
				setStatus('saved');
			} else {
				setServerError(result.error ?? UNEXPECTED_ERROR_MESSAGE);
			}
		} catch (error) {
			console.error('updateAgentConfigAction failed:', error);
			setServerError(UNEXPECTED_ERROR_MESSAGE);
		}
	};

	const renderTextField = ({ name, label, description, inputMode }: TextFieldMeta) => (
		<Controller
			key={name}
			name={name}
			control={form.control}
			render={({ field, fieldState }) => (
				<Field data-invalid={fieldState.invalid}>
					<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
					<Input
						{...field}
						id={field.name}
						inputMode={inputMode}
						autoComplete="off"
						aria-invalid={fieldState.invalid}
					/>
					<FieldDescription>{description}</FieldDescription>
					{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
				</Field>
			)}
		/>
	);

	const renderSwitchField = ({ name, label, description }: SwitchFieldMeta) => (
		<Controller
			key={name}
			name={name}
			control={form.control}
			render={({ field }) => (
				<Field orientation="horizontal">
					<Switch
						id={field.name}
						aria-label={label}
						checked={field.value}
						onCheckedChange={field.onChange}
						onBlur={field.onBlur}
					/>
					<div className="space-y-1">
						<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
						<FieldDescription>{description}</FieldDescription>
					</div>
				</Field>
			)}
		/>
	);

	return (
		<form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-3xl space-y-8">
			<FieldSet>
				<FieldLegend>Режим</FieldLegend>
				<FieldGroup>
					<Controller
						name="engine"
						control={form.control}
						render={({ field }) => (
							<FieldSet className="space-y-2">
								<FieldLegend variant="label">{ENGINE_LEGEND}</FieldLegend>
								<RadioGroup
									aria-label={ENGINE_LEGEND}
									value={field.value}
									onValueChange={(value: unknown) => {
										if (isEngine(value)) field.onChange(value);
									}}
									className="flex flex-wrap gap-4"
								>
									{AGENT_ENGINES.map((option) => (
										<Field key={option} orientation="horizontal" className="w-auto">
											<RadioGroupItem value={option} id={`settings-engine-${option}`} />
											<FieldLabel htmlFor={`settings-engine-${option}`} className="font-normal">
												{ENGINE_LABELS[option]}
											</FieldLabel>
										</Field>
									))}
								</RadioGroup>
							</FieldSet>
						)}
					/>
					{SWITCH_FIELDS.map(renderSwitchField)}
					<div className="grid gap-6 sm:grid-cols-2">{TIMER_FIELDS.map(renderTextField)}</div>
				</FieldGroup>
			</FieldSet>

			<FieldSet>
				<FieldLegend>Пороги решений</FieldLegend>
				<FieldGroup className="grid gap-6 sm:grid-cols-2">{THRESHOLD_FIELDS.map(renderTextField)}</FieldGroup>
			</FieldSet>

			<FieldSet>
				<FieldLegend>Лимиты</FieldLegend>
				<FieldGroup className="grid gap-6 sm:grid-cols-2">{LIMIT_FIELDS.map(renderTextField)}</FieldGroup>
			</FieldSet>

			<div className="flex flex-wrap items-center gap-4">
				<Button type="submit" disabled={isSaving}>
					{isSaving ? 'Сохраняем…' : 'Сохранить'}
				</Button>
				{status === 'saved' && (
					<p role="status" className="text-sm text-muted-foreground">
						{SAVED_MESSAGE}
					</p>
				)}
				{serverError && (
					<p role="alert" className="text-sm text-destructive">
						{serverError}
					</p>
				)}
			</div>
		</form>
	);
}
