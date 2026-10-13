'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { checkModelAction, resetPromptAction, updateLlmSettingsAction } from '@/actions/settings';
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
import { Textarea } from '@/components/ui/textarea';
import type { CheckModelResult } from '@/lib/llm/check-model';
import {
	createLlmSettingsFormSchema,
	toLlmSettingsFormValues,
	type LlmSettingsFormValues,
	type LlmSettingsInput,
} from '@/lib/validations/llm-settings';

interface LlmSettingsFormProps {
	config: LlmSettingsInput;
	/** Встроенный системный промпт: показывается, пока в конфиге `null`, и подставляется при сбросе. */
	builtInPrompt: string;
}

type Status = 'saved' | 'reset' | null;

const SAVED_MESSAGE = 'Сохранено';
const RESET_MESSAGE = 'Промпт возвращён по умолчанию';
const UNEXPECTED_ERROR_MESSAGE = 'Не удалось сохранить настройки LLM. Попробуйте ещё раз';
const CHECK_UNEXPECTED_ERROR_MESSAGE = 'Не удалось проверить модель. Попробуйте ещё раз';
const RESET_UNEXPECTED_ERROR_MESSAGE = 'Не удалось вернуть промпт по умолчанию. Попробуйте ещё раз';
const EVAL_WARNING = 'После правки промпта перепрогоните npm run eval:llm: оценка проверяет качество по тексту промпта.';
const PROMPT_ROWS = 14;

function describeCheck(result: CheckModelResult): string {
	return result.ok
		? `Модель доступна (${result.ms} мс)`
		: `Ошибка: ${result.code} — ${result.message} (${result.ms} мс)`;
}

export function LlmSettingsForm({ config, builtInPrompt }: LlmSettingsFormProps) {
	const [status, setStatus] = useState<Status>(null);
	const [serverError, setServerError] = useState<string | null>(null);
	const [check, setCheck] = useState<CheckModelResult | null>(null);
	const [isChecking, setIsChecking] = useState(false);
	const [isResetting, setIsResetting] = useState(false);

	const form = useForm<LlmSettingsFormValues, unknown, LlmSettingsInput>({
		resolver: zodResolver(createLlmSettingsFormSchema(builtInPrompt)),
		defaultValues: toLlmSettingsFormValues(config, builtInPrompt),
	});
	const isSaving = form.formState.isSubmitting;

	const clearMessages = () => {
		setStatus(null);
		setServerError(null);
		setCheck(null);
	};

	// В action уходят значения формы (строки): сервер проверяет их той же схемой
	const onSubmit = async () => {
		clearMessages();
		try {
			const result = await updateLlmSettingsAction(form.getValues());
			if (result.success && result.data) {
				form.reset(toLlmSettingsFormValues(result.data, builtInPrompt));
				setStatus('saved');
			} else {
				setServerError(result.error ?? UNEXPECTED_ERROR_MESSAGE);
			}
		} catch (error) {
			console.error('updateLlmSettingsAction failed:', error);
			setServerError(UNEXPECTED_ERROR_MESSAGE);
		}
	};

	// Проверка идёт по значениям формы до сохранения; промпт в запросе не участвует
	const onCheck = async () => {
		clearMessages();
		const valid = await form.trigger(['llmModelUri', 'llmTemperature']);
		if (!valid) return;

		setIsChecking(true);
		try {
			const { llmModelUri, llmTemperature } = form.getValues();
			const result = await checkModelAction({ llmModelUri, llmTemperature });
			if (result.success && result.data) setCheck(result.data);
			else setServerError(result.error ?? CHECK_UNEXPECTED_ERROR_MESSAGE);
		} catch (error) {
			console.error('checkModelAction failed:', error);
			setServerError(CHECK_UNEXPECTED_ERROR_MESSAGE);
		} finally {
			setIsChecking(false);
		}
	};

	const onReset = async () => {
		clearMessages();
		setIsResetting(true);
		try {
			const result = await resetPromptAction();
			if (result.success) {
				form.setValue('llmSystemPrompt', builtInPrompt, { shouldValidate: true });
				setStatus('reset');
			} else {
				setServerError(result.error ?? RESET_UNEXPECTED_ERROR_MESSAGE);
			}
		} catch (error) {
			console.error('resetPromptAction failed:', error);
			setServerError(RESET_UNEXPECTED_ERROR_MESSAGE);
		} finally {
			setIsResetting(false);
		}
	};

	const isBusy = isSaving || isChecking || isResetting;

	return (
		<form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-3xl space-y-6">
			<FieldSet>
				<FieldLegend>LLM</FieldLegend>
				<FieldGroup>
					<div className="grid gap-6 sm:grid-cols-2">
						<Controller
							name="llmModelUri"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>URI модели</FieldLabel>
									<Input {...field} id={field.name} autoComplete="off" aria-invalid={fieldState.invalid} />
									<FieldDescription>
										gpt://&lt;каталог&gt;/&lt;модель&gt;/&lt;версия&gt;. Пусто — LLM_MODEL_URI из env или модель по умолчанию
									</FieldDescription>
									{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
								</Field>
							)}
						/>
						<Controller
							name="llmTemperature"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor={field.name}>Температура</FieldLabel>
									<Input
										{...field}
										id={field.name}
										inputMode="decimal"
										autoComplete="off"
										aria-invalid={fieldState.invalid}
									/>
									<FieldDescription>От 0 до 1. Пусто — значение по умолчанию (0,2)</FieldDescription>
									{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
								</Field>
							)}
						/>
					</div>
					<Controller
						name="llmSystemPrompt"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel htmlFor={field.name}>Системный промпт</FieldLabel>
								<Textarea
									{...field}
									id={field.name}
									rows={PROMPT_ROWS}
									spellCheck={false}
									aria-invalid={fieldState.invalid}
									className="font-mono"
								/>
								<FieldDescription>{EVAL_WARNING}</FieldDescription>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
				</FieldGroup>
			</FieldSet>

			<div className="flex flex-wrap items-center gap-4">
				<Button type="submit" disabled={isBusy}>
					{isSaving ? 'Сохраняем…' : 'Сохранить'}
				</Button>
				<Button type="button" variant="outline" onClick={onCheck} disabled={isBusy}>
					{isChecking ? 'Проверяем…' : 'Проверить модель'}
				</Button>
				<Button type="button" variant="outline" onClick={onReset} disabled={isBusy}>
					Вернуть по умолчанию
				</Button>
			</div>
			<div className="space-y-1" aria-live="polite">
				{status && (
					<p role="status" className="text-sm text-muted-foreground">
						{status === 'saved' ? SAVED_MESSAGE : RESET_MESSAGE}
					</p>
				)}
				{check && (
					<p
						role={check.ok ? 'status' : 'alert'}
						className={check.ok ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'}
					>
						{describeCheck(check)}
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
