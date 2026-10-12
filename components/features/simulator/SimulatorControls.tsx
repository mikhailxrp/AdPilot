'use client';

import { useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetAction, setTimerAction, tickAction, type TickSummary } from '@/actions/simulator';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_SEED, resetSchema, type ResetFormInput, type ResetInput } from '@/lib/validations/simulator';

interface SimulatorControlsProps {
	hasRun: boolean;
	timerEnabled: boolean;
}

const UNEXPECTED_ERROR_MESSAGE = 'Не удалось выполнить операцию. Попробуйте ещё раз';

export function SimulatorControls({ hasRun, timerEnabled }: SimulatorControlsProps) {
	const [isTimerOn, setIsTimerOn] = useState(timerEnabled);
	const [tickError, setTickError] = useState<string | null>(null);
	const [tickSummary, setTickSummary] = useState<TickSummary | null>(null);
	const [timerError, setTimerError] = useState<string | null>(null);
	const [isTickPending, startTick] = useTransition();
	const [isTimerPending, startTimer] = useTransition();

	const form = useForm<ResetFormInput, unknown, ResetInput>({
		resolver: zodResolver(resetSchema),
		defaultValues: { seed: String(DEFAULT_SEED) },
	});
	const isResetting = form.formState.isSubmitting;
	const isBusy = isTickPending || isResetting;

	const handleTick = () => {
		setTickError(null);
		setTickSummary(null);
		startTick(async () => {
			try {
				const result = await tickAction();
				if (result.success) setTickSummary(result.data ?? null);
				else setTickError(result.error ?? UNEXPECTED_ERROR_MESSAGE);
			} catch (error) {
				console.error('tickAction failed:', error);
				setTickError(UNEXPECTED_ERROR_MESSAGE);
			}
		});
	};

	const handleTimerChange = (checked: boolean) => {
		setTimerError(null);
		startTimer(async () => {
			try {
				const result = await setTimerAction({ timerEnabled: checked });
				if (result.success) setIsTimerOn(checked);
				else setTimerError(result.error ?? UNEXPECTED_ERROR_MESSAGE);
			} catch (error) {
				console.error('setTimerAction failed:', error);
				setTimerError(UNEXPECTED_ERROR_MESSAGE);
			}
		});
	};

	const onReset = async (data: ResetInput) => {
		setTickError(null);
		setTickSummary(null);
		try {
			const result = await resetAction(data);
			if (!result.success) {
				form.setError('seed', { message: result.error ?? UNEXPECTED_ERROR_MESSAGE });
			}
		} catch (error) {
			console.error('resetAction failed:', error);
			form.setError('seed', { message: UNEXPECTED_ERROR_MESSAGE });
		}
	};

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
			<div className="space-y-2">
				<Button type="button" onClick={handleTick} disabled={!hasRun || isBusy}>
					{isTickPending ? 'Считаем…' : 'Один тик'}
				</Button>
				{tickError && (
					<p role="alert" className="text-sm text-destructive">
						{tickError}
					</p>
				)}
				{tickSummary && !tickSummary.cycleError && (
					<p role="status" className="text-sm text-muted-foreground">
						Агент: решений {tickSummary.decisions}
						{tickSummary.failures > 0 && `, сбоев ${tickSummary.failures}`}
					</p>
				)}
				{tickSummary?.cycleError && (
					<p role="alert" className="text-sm text-destructive">
						Тик {tickSummary.tick} выполнен, но агент не отработал: {tickSummary.cycleError}
					</p>
				)}
			</div>
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<Switch
						id="agent-timer"
						aria-label="Таймер агента"
						checked={isTimerOn}
						onCheckedChange={handleTimerChange}
						disabled={isTimerPending}
					/>
					<Label htmlFor="agent-timer">Таймер агента</Label>
				</div>
				{timerError && (
					<p role="alert" className="text-sm text-destructive">
						{timerError}
					</p>
				)}
			</div>
			<form onSubmit={form.handleSubmit(onReset)} noValidate className="w-full max-w-xs shrink-0 sm:w-xs">
				<FieldGroup>
					<Controller
						name="seed"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid}>
								<FieldLabel htmlFor={field.name}>Seed</FieldLabel>
								<Input
									{...field}
									value={String(field.value ?? '')}
									id={field.name}
									inputMode="numeric"
									autoComplete="off"
									aria-invalid={fieldState.invalid}
								/>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
					<Button type="submit" variant="outline" disabled={isBusy}>
						{isResetting ? 'Сбрасываем…' : 'Сбросить'}
					</Button>
				</FieldGroup>
			</form>
		</div>
	);
}
