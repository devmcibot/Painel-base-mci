"use client";

import { useRef, useState } from "react";

type Props = {
  folderPath?: string | null;
  consultaId?: number | null;
  onUploaded?: () => Promise<void> | void; // callback pra recarregar a lista
};

export default function UploadButton({ folderPath, consultaId, onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function doUpload(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    if (folderPath) fd.append("folderPath", folderPath);
    else if (consultaId) fd.append("consultaId", String(consultaId));

    setBusy(true);
    const res = await fetch("/api/storage/upload", { method: "POST", body: fd });
    setBusy(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Falha no upload");
      return;
    }

    // limpa input e força recarregar a lista
    if (inputRef.current) inputRef.current.value = "";
    await onUploaded?.();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void doUpload(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
      >
        {busy ? "Enviando..." : "Upload"}
      </button>
    </div>
  );
}
