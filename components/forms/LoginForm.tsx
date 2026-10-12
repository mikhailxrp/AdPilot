'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { Input } from '@/components/ui/input';
import { loginSchema, type LoginInput } from '@/lib/validations/auth';

const DASHBOARD_PATH = '/dashboard';
const INVALID_CREDENTIALS_MESSAGE = 'Неверный email или пароль';
const UNEXPECTED_ERROR_MESSAGE = 'Не удалось выполнить вход. Попробуйте ещё раз';

export function LoginForm() {
	const router = useRouter();
	const [formError, setFormError] = useState<string | null>(null);

	const form = useForm<LoginInput>({
		resolver: zodResolver(loginSchema),
		defaultValues: { email: '', password: '' },
	});

	const onSubmit = async (data: LoginInput) => {
		setFormError(null);

		try {
			const result = await signIn('credentials', { ...data, redirect: false });

			if (result?.error) {
				setFormError(INVALID_CREDENTIALS_MESSAGE);
				return;
			}

			router.push(DASHBOARD_PATH);
			router.refresh();
		} catch (error) {
			console.error('signIn failed:', error);
			setFormError(UNEXPECTED_ERROR_MESSAGE);
		}
	};

	return (
		<form onSubmit={form.handleSubmit(onSubmit)} noValidate>
			<FieldGroup>
				<Controller
					name="email"
					control={form.control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor={field.name}>Email</FieldLabel>
							<Input
								{...field}
								id={field.name}
								type="email"
								autoComplete="email"
								aria-invalid={fieldState.invalid}
							/>
							{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
						</Field>
					)}
				/>
				<Controller
					name="password"
					control={form.control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<FieldLabel htmlFor={field.name}>Пароль</FieldLabel>
							<PasswordInput
								{...field}
								id={field.name}
								autoComplete="current-password"
								aria-invalid={fieldState.invalid}
							/>
							{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
						</Field>
					)}
				/>
				{formError && <FieldError>{formError}</FieldError>}
				<Button type="submit" disabled={form.formState.isSubmitting}>
					{form.formState.isSubmitting ? 'Входим…' : 'Войти'}
				</Button>
			</FieldGroup>
		</form>
	);
}
