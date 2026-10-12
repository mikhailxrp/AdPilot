'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type'>;

export function PasswordInput({ ...props }: PasswordInputProps) {
	const [isVisible, setIsVisible] = useState(false);
	const label = isVisible ? 'Скрыть пароль' : 'Показать пароль';

	return (
		<div className="relative">
			<Input {...props} type={isVisible ? 'text' : 'password'} className="pr-9" />
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="absolute top-0.5 right-0.5"
				aria-label={label}
				aria-pressed={isVisible}
				onClick={() => setIsVisible((visible) => !visible)}
			>
				{isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
			</Button>
		</div>
	);
}
