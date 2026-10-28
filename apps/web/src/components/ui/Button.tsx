import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const variantClasses = {
      default: 'bg-primary text-primary-foreground hover:bg-emerald-400 font-semibold shadow-sm',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-slate-800',
      outline: 'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-red-700',
    };

    const sizeClasses = {
      default: 'h-10 py-2 px-4 text-sm min-h-[44px]',
      sm: 'h-8 px-3 text-xs relative min-h-[36px] min-w-[36px] sm:min-h-0 before:content-[\'\'] before:absolute before:-inset-1.5',
      lg: 'h-12 px-6 text-base min-h-[48px]',
      icon: 'h-10 w-10 p-0 min-h-[44px] min-w-[44px]',
    };

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
