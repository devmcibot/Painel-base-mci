// src/app/medico/teleconsulta/Call.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { sb } from "@/lib/realtime";
import { ensureConsultaFolder, uploadTextFile } from "@/lib/storage";
import { useSession } from "next-auth/react";

function ts() { /* ...igual ao que já te mandei... */ }

type SignalMsg =
  | { type: "offer"; sdp: any }
  | { type: "answer"; sdp: any }
  | { type: "ice"; candidate: any }
  | { type: "stt"; speaker: "MEDICO" | "PACIENTE"; text: string; final: boolean };

export default function Call({
  medicoId,
  pacienteId,
  nome,
  cpf,
  consultaId,
}: {
  medicoId: number;
  pacienteId: number;
  nome: string;
  cpf: string | null;
  consultaId: number;
}) {
  const { data } = useSession();
  const role = (data?.user as { role?: string } | undefined)?.role;
  const mySpeaker: "MEDICO" | "PACIENTE" = role === "ADMIN" ? "MEDICO" : role === "MÉDICO" || role === "MEDICO" ? "MEDICO" : "PACIENTE";

  // ... resto igual, usando channel `tele-${consultaId}` ...
  // NO onresult da Web Speech, troque o rótulo fixo "[MEDICO]" por `[mySpeaker]`:
  // setTranscript(prev => prev + `\n[${mySpeaker}] ${text}`);
  // e envie no payload: { speaker: mySpeaker, ... }

  // No stopAndUpload, troque o ensureConsultaFolder para usar os props reais:
  async function stopAndUpload() {
    if (!recorderRef.current) return;
    recorderRef.current.stop();

    const onStop = async () => {
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });

      const fileName = `tele_${ts()}.webm`;
      const txtName  = `tele_transcricao_${ts()}.txt`;

      const folder = await ensureConsultaFolder({
        medicoId,
        pacienteId,
        nome,
        cpf,
        consultaId,
        data: new Date(),
      });

      const fullAudioPath = `${folder}/${fileName}`;
      const buf = Buffer.from(await blob.arrayBuffer());
      const { supabaseAdmin } = await import("@/lib/supabase");
      const bucket = process.env.STORAGE_BUCKET || process.env.SUPABASE_BUCKET!;
      const { error: upErr } = await supabaseAdmin
        .storage
        .from(bucket)
        .upload(fullAudioPath, buf, { contentType: "audio/webm", upsert: true });
      if (upErr) throw upErr;

      const fullTxtPath = `${folder}/${txtName}`;
      await uploadTextFile(fullTxtPath, transcript);

      alert("Tele-consulta salva com sucesso!");
    };
    recorderRef.current.onstop = onStop;
  }

  // ... (restante do código como te enviei)
}
