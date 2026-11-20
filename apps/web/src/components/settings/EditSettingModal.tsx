import { useEffect, useId, useRef, useState } from 'react';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';
import { Button } from '@/components/ui/Button';
import { AlertCircle, Check, Eye, EyeOff, Loader2, X } from 'lucide-react';

export interface EditSettingOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

export interface EditSettingModalProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly label: string;
  readonly description?: string;
  readonly type?: 'text' | 'select' | 'password';
  readonly initialValue: string;
  readonly placeholder?: string;
  readonly options?: readonly EditSettingOption[];
  readonly validate?: (value: string) => string | null;
  readonly saveLabel?: string;
  readonly onClose: () => void;
  readonly onSave: (value: string) => Promise<void> | void;
}

/**
 * Reusable single-field editor modal supporting text, select/dropdown, and password inputs
 * with auto-focus, Enter submit, Escape cancel, inline validation, and saving state.
 */
export function EditSettingModal({
  isOpen,
  title,
  label,
  description,
  type = 'text',
  initialValue,
  placeholder,
  options = [],
  validate,
  saveLabel = 'Save',
  onClose,
  onSave,
}: EditSettingModalProps) {
  const inputId = useId();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setValue(initialValue);
    setError(null);
    setIsSaving(false);
    setShowPassword(false);

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      if (inputRef.current instanceof HTMLInputElement && type === 'text') {
        inputRef.current.select();
      }
    }, 10);

    return () => window.clearTimeout(timer);
  }, [isOpen, initialValue, type]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const validationError = validate ? validate(value) : null;
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSave(value);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save setting.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ResponsiveModalShell
      portal
      variant="sheet"
      role="dialog"
      ariaLabelledBy={titleId}
      panelClassName="max-w-md bg-slate-900 border-slate-800"
      onBackdropClick={() => {
        if (!isSaving) onClose();
      }}
      onPanelKeyDown={(e) => {
        if (e.key === 'Escape' && !isSaving) {
          e.stopPropagation();
          onClose();
        }
      }}
      header={
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 id={titleId} className="text-sm font-semibold text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close dialog"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      }
      formProps={{
        onSubmit: handleSubmit,
        noValidate: true,
      }}
      bodyClassName="p-4 space-y-3"
      footer={
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-800 bg-slate-950/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="h-8 text-xs text-slate-300 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSaving}
            className="h-8 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                {saveLabel}
              </>
            )}
          </Button>
        </div>
      }
    >
      {description && <p className="text-xs text-slate-400">{description}</p>}

      <div>
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-300 mb-1.5">
          {label}
        </label>

        {type === 'select' ? (
          <select
            id={inputId}
            ref={(el) => {
              inputRef.current = el;
            }}
            value={value}
            disabled={isSaving}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            className="w-full h-9 rounded-lg bg-slate-950 border border-slate-800 px-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
                {opt.hint ? ` — ${opt.hint}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <div className="relative">
            <input
              id={inputId}
              ref={(el) => {
                inputRef.current = el;
              }}
              type={type === 'password' ? (showPassword ? 'text' : 'password') : 'text'}
              value={value}
              disabled={isSaving}
              placeholder={placeholder}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              className={`w-full h-9 rounded-lg bg-slate-950 border px-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                type === 'password' ? 'pr-9' : ''
              } ${
                error
                  ? 'border-rose-500/80 focus:border-rose-500'
                  : 'border-slate-800 focus:border-emerald-500'
              }`}
            />
            {type === 'password' && (
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide value' : 'Show value'}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </ResponsiveModalShell>
  );
}
