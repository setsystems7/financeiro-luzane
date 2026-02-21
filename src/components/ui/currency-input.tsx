import React, { useState, useEffect, useRef } from 'react';
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
 * Formats a raw numeric string (in cents) to Brazilian currency display.
 * E.g. "1500" -> "15,00", "100" -> "1,00"
 */
function formatCentsToDisplay(cents: string): string {
  const num = parseInt(cents || '0', 10);
  const reais = Math.floor(num / 100);
  const centavos = (num % 100).toString().padStart(2, '0');
  
  // Format with thousands separator
  const reaisFormatted = reais.toLocaleString('pt-BR');
  return `${reaisFormatted},${centavos}`;
}

/**
 * Converts a decimal string (e.g. "15.00", "15", "1500") to cents string.
 */
function decimalToCents(value: string): string {
  if (!value || value === '0') return '0';
  
  // Remove everything except digits, comma and dot
  const cleaned = value.replace(/[^\d.,]/g, '');
  
  // If it has comma, treat as Brazilian format
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    const intPart = parts[0].replace(/\./g, ''); // remove thousands separator
    const decPart = (parts[1] || '00').padEnd(2, '0').substring(0, 2);
    return String(parseInt(intPart || '0', 10) * 100 + parseInt(decPart, 10));
  }
  
  // If it has a dot, treat as decimal
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    const intPart = parts[0];
    const decPart = (parts[1] || '00').padEnd(2, '0').substring(0, 2);
    return String(parseInt(intPart || '0', 10) * 100 + parseInt(decPart, 10));
  }
  
  // Pure integer - could be cents or reais. If the value looks like it was
  // already stored as a decimal (e.g. "15" meaning R$15.00), treat as reais.
  return String(parseInt(cleaned, 10) * 100);
}

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display from external value (decimal string like "15.00")
  useEffect(() => {
    const cents = decimalToCents(value);
    setDisplayValue(formatCentsToDisplay(cents));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    
    // Extract only digits
    const digits = rawInput.replace(/\D/g, '');
    
    // Update display
    const formatted = formatCentsToDisplay(digits);
    setDisplayValue(formatted);
    
    // Convert to decimal string for parent (e.g. "1500" cents -> "15.00")
    const numericValue = parseInt(digits || '0', 10);
    const decimalValue = (numericValue / 100).toFixed(2);
    onChange(decimalValue);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select all on focus for easy editing
    setTimeout(() => {
      e.target.select();
    }, 0);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
      <Input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        className={cn('pl-10 text-right', className)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  );
}
