'use client';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

export function StepShell({ step, title, subtitle, children, onBack, onNext, nextLabel = 'Continue', nextDisabled, nextBlockedReason }: {
  step: number; title: string; subtitle?: string; children: ReactNode;
  onBack?: () => void; onNext?: () => void; nextLabel?: string;
  nextDisabled?: boolean; nextBlockedReason?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#E5E5E5] px-8 py-5">
        <p className="text-xs tracking-widest uppercase text-[#767676]">Step {step} of 4</p>
        <h1 className="text-xl mt-1">{title}</h1>
        {subtitle && <p className="text-sm text-[#767676] mt-1">{subtitle}</p>}
      </header>
      <main className="flex-1 px-8 py-6 overflow-auto">{children}</main>
      <footer className="border-t border-[#E5E5E5] px-8 py-4 flex items-center gap-3">
        {onBack && <Button variant="ghost" onClick={onBack}>Back</Button>}
        <div className="flex-1" />
        {nextDisabled && nextBlockedReason && (
          <span className="text-sm text-[#767676]">{nextBlockedReason}</span>
        )}
        {onNext && <Button onClick={onNext} disabled={nextDisabled}>{nextLabel}</Button>}
      </footer>
    </div>
  );
}
