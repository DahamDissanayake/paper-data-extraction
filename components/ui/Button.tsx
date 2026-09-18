'use client';
import type { ButtonHTMLAttributes } from 'react';

export function Button({ variant = 'primary', className = '', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const base = 'px-4 py-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const style = variant === 'primary'
    ? 'bg-[#0A0A0A] text-white hover:bg-[#333]'
    : 'border border-[#E5E5E5] text-[#0A0A0A] hover:bg-[#F5F5F5]';
  return <button className={`${base} ${style} ${className}`} {...props} />;
}
