'use client';
import { useRef, useState } from 'react';
import { StepShell } from './StepShell';
import { useSessionStore } from '@/lib/session/store';

export function UploadStep() {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const { session, setSession } = useSessionStore();

  async function accept(files: FileList | null) {
    if (!files?.length) return;
    const isPdf = files[0].type === 'application/pdf';
    const allImages = [...files].every((f) => f.type.startsWith('image/'));
    if (!isPdf && !allImages) { setError('Upload one PDF, or a single JPG/PNG page.'); return; }
    if (isPdf && files.length > 1) { setError('Upload a single PDF at a time.'); return; }
    // `Session.sourceBlob` holds one Blob, so only files[0] is ever used.
    // Accepting a multi-page image selection would silently drop every page
    // but the first, so say no instead of pretending.
    if (allImages && files.length > 1) {
      setError('Only one image at a time for now — upload a PDF for a multi-page paper.');
      return;
    }
    setError('');
    if (!session) return;
    setSession({
      ...session,
      sourceName: files[0].name,
      sourceKind: isPdf ? 'pdf' : 'images',
      step: 2,
    }, files[0]);
  }

  return (
    <StepShell step={1} title="Upload a paper"
      subtitle="Everything stays in your browser. Nothing is uploaded to a server.">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void accept(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        className="border border-dashed border-[#E5E5E5] h-72 flex flex-col items-center justify-center cursor-pointer hover:bg-[#FAFAFA]"
      >
        <p className="text-sm">Drop a PDF here, or click to choose</p>
        <p className="text-xs text-[#767676] mt-2">One PDF, or a single JPG / PNG page</p>
        <input ref={input} type="file" hidden accept="application/pdf,image/*" multiple
               onChange={(e) => void accept(e.target.files)} />
      </div>
      {error && <p className="text-sm mt-3">{error}</p>}
    </StepShell>
  );
}
