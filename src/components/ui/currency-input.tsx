import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * Simple currency input that accepts comma as decimal separator (Brazilian format).
 * Stores value as a standard decimal string (e.g. "15.00").
 */
export function CurrencyInput({
  value,
  onChange,
  id,
  placeholder = '0,00',
  required,
  className,
  disabled,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  // Sync display from external value (decimal string like "15" or "15.00")
  useEffect(() => {
    if (value === '' || value === undefined || value === null) {
      setDisplayValue('');
      return;
    }
    const num = parseFloat(value);
    if (isNaN(num)) {
      setDisplayValue('');
      return;
    }
    // Show with comma as decimal separator
    setDisplayValue(num.toFixed(2).replace('.', ','));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    
    // Allow only digits, comma, and dot
    raw = raw.replace(/[^\d.,]/g, '');
    
    // Replace comma with dot for internal handling, but keep display with comma
    setDisplayValue(raw);
  };

  const handleBlur = () => {
    if (!displayValue || displayValue.trim() === '') {
      onChange('0');
      setDisplayValue('0,00');
      return;
    }

    // Convert comma to dot for parsing
    const normalized = displayValue.replace(',', '.');
    const num = parseFloat(normalized);
    
    if (isNaN(num)) {
      onChange('0');
      setDisplayValue('0,00');
      return;
    }

    // Store as decimal string
    onChange(num.toFixed(2));
    // Display formatted with comma
    setDisplayValue(num.toFixed(2).replace('.', ','));
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn('pl-10', className)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  );
}
