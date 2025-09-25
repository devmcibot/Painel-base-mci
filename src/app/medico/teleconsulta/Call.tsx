// src/app/medico/teleconsulta/Call.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { sb } from "@/lib/realtime";

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
  const { data } = useSession();
  const role = (data?.user as { role?: Role } | undefined)?.role;
  const mySpeaker: "MEDICO" | "PACIENTE" =
    role === "ADMIN" || role === "MÉDICO" || role === "MEDICO" ? "MEDICO" : "PACIENTE";

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

  const [uiError, setUiError] = useState<string | null>(null);

  const channel = useMemo(() => sb.channel(`tele-${consultaId}`), [consultaId]);

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

  useEffect(() => {
    if (!roomReady) return;

    (async () => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
        });
        pcRef.current = pc;

        const remote = new MediaStream();
        setRemoteStream(remote);
        pc.ontrack = (ev) => {
          ev.streams[0].getTracks().forEach((t) => remote.addTrack(t));
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
        };

        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            const msg: SignalMsg = { type: "ice", candidate: ev.candidate.toJSON() };
            channel.send({ type: "broadcast", event: "signal", payload: msg });
          }
        };

        const local = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(local);
        local.getTracks().forEach((t) => pc.addTrack(t, local));
        if (localVideoRef.current) localVideoRef.current.srcObject = local;

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

  useEffect(() => {
    const SR =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition ||
      null;

    if (!SR) {
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

        setTranscript((prev) => prev + `\n[${mySpeaker}] ${text}`);

        const msg: SignalMsg = { type: "stt", speaker: mySpeaker, text, final };
        channel.send({ type: "broadcast", event: "signal", payload: msg });
      }
    };
    rec.onerror = () => {};
    rec.onend = () => {
      try { rec.start(); } catch {}
    };

    try { rec.start(); } catch {}

    return () => {
      try { rec.stop(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, mySpeaker]);

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

    const timestamp = ts();
    mr.onstop = async () => {
      try {
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Envia para a API server
        const form = new FormData();
        form.append("audio", blob, `tele_${timestamp}.webm`);
        form.append(
          "meta",
          JSON.stringify({
            medicoId,
            pacienteId,
            nome,
            cpf,
            consultaId,
            timestamp,
            transcript,
          })
        );

        const resp = await fetch("/api/tele/save", { method: "POST", body: form });
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${resp.status}`);
        }

        alert("Tele-consulta salva com sucesso!");
      } catch (e: any) {
        setUiError(`Falha ao salvar arquivos: ${e?.message || String(e)}`);
      }
    };

    try {
      mr.stop();
    } catch {}
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
          Se o navegador não suportar Web Speech, aparece um aviso. A chamada funciona normalmente.
        </p>
      </div>
    </div>
  );
}
