// src/app/medico/teleconsulta/Call.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { sb } from "@/lib/realtime";
import { ensureConsultaFolder, uploadTextFile } from "@/lib/storage";

type Role = "ADMIN" | "MEDICO" | "MÉDICO" | string;

type SignalMsg =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit }
  | { type: "stt"; speaker: "MEDICO" | "PACIENTE"; text: string; final: boolean };

function ts() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

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
  // --- sessão/role para rotular falas ---
  const { data } = useSession();
  const role = (data?.user as { role?: Role } | undefined)?.role;
  const mySpeaker: "MEDICO" | "PACIENTE" =
    role === "ADMIN" || role === "MÉDICO" || role === "MEDICO" ? "MEDICO" : "PACIENTE";

  // --- estados/refs principais ---
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [roomReady, setRoomReady] = useState(false);
  const [isCaller, setIsCaller] = useState<boolean | null>(null);

  // gravação
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // transcrição
  const [transcript, setTranscript] = useState<string>("");
  const recognizerRef = useRef<any | null>(null);

  // erros visíveis (sem quebrar a tela)
  const [uiError, setUiError] = useState<string | null>(null);

  // canal Realtime por consulta
  const channel = useMemo(() => sb.channel(`tele-${consultaId}`), [consultaId]);

  // ===== 1) SINALIZAÇÃO PELO SUPABASE REALTIME =====
  useEffect(() => {
    const sub = channel
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const msg = payload as SignalMsg;
        const pc = pcRef.current;
        if (!pc) return;

        try {
          if (msg.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            channel.send({ type: "broadcast", event: "signal", payload: { type: "answer", sdp: ans } });
          } else if (msg.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          } else if (msg.type === "ice" && msg.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } else if (msg.type === "stt") {
            setTranscript((prev) => (msg.text ? prev + `\n[${msg.speaker}] ${msg.text}` : prev));
          }
        } catch (e: any) {
          setUiError(`Erro na sinalização: ${e?.message || String(e)}`);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRoomReady(true);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [channel]);

  // ===== 2) SETUP WEBRTC (pega câmera/mic, cria RTCPeerConnection) =====
  useEffect(() => {
    if (!roomReady) return;

    (async () => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
        });
        pcRef.current = pc;

        // remoto
        const remote = new MediaStream();
        setRemoteStream(remote);
        pc.ontrack = (ev) => {
          ev.streams[0].getTracks().forEach((t) => remote.addTrack(t));
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
        };

        // candidatos
        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            const msg: SignalMsg = { type: "ice", candidate: ev.candidate.toJSON() };
            channel.send({ type: "broadcast", event: "signal", payload: msg });
          }
        };

        // local
        const local = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(local);
        local.getTracks().forEach((t) => pc.addTrack(t, local));
        if (localVideoRef.current) localVideoRef.current.srcObject = local;

        // quem cria a OFFER? o primeiro que entrar define isCaller=true
        setIsCaller(true);
      } catch (e: any) {
        setUiError(
          e?.name === "NotAllowedError"
            ? "Permita acesso ao microfone/câmera para iniciar a chamada."
            : `Erro ao acessar câmera/microfone: ${e?.message || String(e)}`
        );
      }
    })();

    return () => {
      pcRef.current?.close();
      pcRef.current = null;
      localStream?.getTracks().forEach((t) => t.stop());
      recognizerRef.current?.stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomReady]);

  // ===== 3) SE SOU CALLER, CRIO E ENVIO A OFFER =====
  useEffect(() => {
    (async () => {
      if (!roomReady || isCaller !== true) return;
      const pc = pcRef.current;
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const msg: SignalMsg = { type: "offer", sdp: offer };
      channel.send({ type: "broadcast", event: "signal", payload: msg });
    })();
  }, [roomReady, isCaller, channel]);

  // ===== 4) TRANSCRIÇÃO LOCAL (Web Speech) =====
  useEffect(() => {
    const SR =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition ||
      null;

    if (!SR) {
      // Sem Web Speech: não quebra; só informa
      setTranscript((prev) => prev + "\n[INFO] Web Speech não disponível neste navegador.");
      return;
    }

    const rec = new SR();
    recognizerRef.current = rec;
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = (r[0]?.transcript || "").trim();
        const final = !!r.isFinal;
        if (!text) continue;

        // mostra local
        setTranscript((prev) => prev + `\n[${mySpeaker}] ${text}`);

        // envia para o outro lado
        const msg: SignalMsg = { type: "stt", speaker: mySpeaker, text, final };
        channel.send({ type: "broadcast", event: "signal", payload: msg });
      }
    };

    rec.onerror = () => {/* silencioso no MVP */};
    rec.onend = () => {
      // tenta manter ligado enquanto a página estiver aberta
      try { rec.start(); } catch {/* ignore */}
    };

    try { rec.start(); } catch {/* ignore */}

    return () => {
      try { rec.stop(); } catch {/* ignore */}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, mySpeaker]);

  // ===== 5) GRAVAÇÃO (mix local + remoto) =====
  async function startRecording() {
    if (!localStream || !remoteStream) {
      setUiError("Fluxos de áudio ainda não prontos.");
      return;
    }

    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();

    const localSrc = ac.createMediaStreamSource(localStream);
    localSrc.connect(dest);

    const remoteSrc = ac.createMediaStreamSource(remoteStream);
    remoteSrc.connect(dest);

    const mixed = new MediaStream();
    dest.stream.getAudioTracks().forEach((t) => mixed.addTrack(t));

    const mr = new MediaRecorder(mixed, { mimeType: "audio/webm" });
    chunksRef.current = [];
    mr.ondataavailable = (e) => e.data && e.data.size > 0 && chunksRef.current.push(e.data);
    mr.onstop = () => setRecording(false);
    mr.start();
    recorderRef.current = mr;
    setRecording(true);
  }

  async function stopAndUpload() {
    if (!recorderRef.current) return;
    const mr = recorderRef.current;
    mr.onstop = async () => {
      try {
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const fileName = `tele_${ts()}.webm`;
        const txtName = `tele_transcricao_${ts()}.txt`;

        // 1) pasta da consulta
        const folder = await ensureConsultaFolder({
          medicoId,
          pacienteId,
          nome,
          cpf,
          consultaId,
          data: new Date(),
        });

        // 2) upload do áudio
        const buf = Buffer.from(await blob.arrayBuffer());
        const { supabaseAdmin } = await import("@/lib/supabase");
        const bucket = process.env.STORAGE_BUCKET || process.env.SUPABASE_BUCKET!;
        const { error: upErr } = await supabaseAdmin
          .storage
          .from(bucket)
          .upload(`${folder}/${fileName}`, buf, { contentType: "audio/webm", upsert: true });
        if (upErr) throw upErr;

        // 3) upload do texto
        await uploadTextFile(`${folder}/${txtName}`, transcript);

        alert("Tele-consulta salva com sucesso!");
      } catch (e: any) {
        setUiError(`Falha ao salvar arquivos: ${e?.message || String(e)}`);
      }
    };
    try {
      mr.stop();
    } catch {/* ignore */}
  }

  return (
    <div className="space-y-4">
      {uiError && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          {uiError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full rounded-xl border" />
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-xl border" />
      </div>

      <div className="flex gap-3">
        {!recording ? (
          <button className="bg-black text-white rounded px-4 py-2" onClick={startRecording}>
            Iniciar Gravação
          </button>
        ) : (
          <button className="bg-red-600 text-white rounded px-4 py-2" onClick={stopAndUpload}>
            Parar & Salvar
          </button>
        )}
      </div>

      <div>
        <h3 className="font-semibold mb-2">Transcrição (ao vivo)</h3>
        <textarea className="w-full h-60 border rounded p-2 text-sm" value={transcript} readOnly />
        <p className="text-xs text-gray-500 mt-1">
          Os trechos dos dois lados chegam via Realtime. Se o navegador não suportar Web Speech, um aviso aparece acima.
        </p>
      </div>
    </div>
  );
}
