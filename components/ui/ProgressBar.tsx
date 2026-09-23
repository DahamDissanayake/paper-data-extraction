/** A simple indeterminate loading bar — for a wait with no known duration or percentage (e.g. OCR). */
export function ProgressBar({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      {label && <p className="text-sm text-[#767676]">{label}</p>}
      <div className="w-56 h-1 bg-[#E5E5E5] overflow-hidden rounded-full">
        <div className="h-full w-1/3 bg-[#0A0A0A] rounded-full progress-sweep" />
      </div>
    </div>
  );
}
