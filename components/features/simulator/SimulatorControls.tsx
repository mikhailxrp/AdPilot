'use client';

import { useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetAction, tickAction } from '@/actions/simulator';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { DEFAULT_SEED, resetSchema, type ResetFormInput, type ResetInput } from '@/lib/validations/simulator';

interface SimulatorControlsProps {
	hasRun: boolean;
}

const UNEXPECTED_ERROR_MESSAGE = 'Не удалось выполнить операцию. Попробуйте ещё раз';

export function SimulatorControls({ hasRun }: SimulatorControlsProps) {
	const [tickError, setTickError] = useState<string | null>(null);
	const [isTickPending, startTick] = useTransition();

	const form = useForm<ResetFormInput, unknown, ResetInput>({
		resolver: zodResolver(resetSchema),
		defaultValues: { seed: String(DEFAULT_SEED) },
	});
	const isResetting = form.formState.isSubmitting;
	const isBusy = isTickPending || isResetting;

	const handleTick = () => {
		setTickError(null);
		startTick(async () => {
			try {
				const result = await tickAction();
				if (!result.success) setTickError(result.error ?? UNEXPECTED_ERROR_MESSAGE);
			} catch (error) {
				console.error('tickAction failed:', error);
				setTickError(UNEXPECTED_ERROR_MESSAGE);
			}
		});
	};

	const onReset = async (data: ResetInput) => {
		setTickError(null);
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
			</div>
			<form onSubmit={form.handleSubmit(onReset)} noValidate className="w-full max-w-xs">
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
