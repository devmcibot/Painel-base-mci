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

// detecção bem simples de iOS (Safari mobile não tem SpeechRecognition)
const isIOS = typeof navigator !== "undefined" && /iP(hone|ad|od)/i.test(navigator.userAgent);

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

  const channel = useMemo(() => sb.channel(`tele-${consultaId}`), [consultaId]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [roomReady, setRoomReady] = useState(false);
  const [callStarted, setCallStarted] = useState(false);
  const callStartedRef = useRef(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // gravação
  const [recState, setRecState] = useState<"idle" | "recording" | "paused">("idle");
  const recStateRef = useRef<"idle" | "recording" | "paused">("idle");
  useEffect(() => {
    recStateRef.current = recState;
  }, [recState]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // transcrição
  const [transcript, setTranscript] = useState<string>("");
  const [sttSupported, setSttSupported] = useState<boolean>(false);
  const recognizerRef = useRef<SpeechRecognition | null>(null);

  const [uiError, setUiError] = useState<string | null>(null);

  const pendingSignalsRef = useRef<SignalMsg[]>([]);

  // ---------------- Realtime ----------------
  useEffect(() => {
    const sub = channel
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const msg = payload as SignalMsg;

        if (!callStartedRef.current) {
          if (msg.type === "offer" || msg.type === "answer" || msg.type === "ice") {
            pendingSignalsRef.current.push(msg);
          }
          if (msg.type === "stt" && msg.final) {
            setTranscript((p) => (msg.text ? p + `\n[${msg.speaker}] ${msg.text}` : p));
          }
          return;
        }

        try {
          const pc = pcRef.current;
          if (!pc) return;

          if (msg.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            channel.send({ type: "broadcast", event: "signal", payload: { type: "answer", sdp: ans } });
          } else if (msg.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          } else if (msg.type === "ice" && msg.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } else if (msg.type === "stt" && msg.final) {
            setTranscript((p) => (msg.text ? p + `\n[${msg.speaker}] ${msg.text}` : p));
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

  // ---------------- STT ----------------
  function startSTT() {
    // iOS não tem STT nativo — informa e sai
    if (isIOS) {
      setSttSupported(false);
      setTranscript((p) => p + "\n[INFO] Transcrição ao vivo indisponível neste dispositivo (iOS).");
      return;
    }

    // encerra instância anterior
    try { recognizerRef.current?.stop(); } catch {}
    recognizerRef.current = null;

    const SR: any =
      typeof window !== "undefined" &&
      ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);

    if (!SR) {
      setSttSupported(false);
      setTranscript((p) => p + "\n[INFO] Web Speech não disponível neste navegador.");
      return;
    }

    setSttSupported(true);

    const rec: SpeechRecognition = new SR();
    recognizerRef.current = rec;
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const finals: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = (r[0]?.transcript || "").trim();
        if (!text) continue;

        if (r.isFinal) {
          finals.push(text);
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: { type: "stt", speaker: mySpeaker, text, final: true } as SignalMsg,
          });
        }
      }
      if (finals.length) {
        setTranscript((p) => p + finals.map((t) => `\n[${mySpeaker}] ${t}`).join(""));
      }
    };

    rec.onend = () => {
      // reinicia enquanto ainda estivermos gravando
      if (recStateRef.current === "recording") {
        setTimeout(() => {
          try { rec.start(); } catch {}
        }, 200);
      }
    };

    try { rec.start(); } catch {}
  }

  function stopSTT() {
    try { recognizerRef.current?.stop(); } catch {}
    recognizerRef.current = null;
  }

  // ---------------- limpeza ----------------
  useEffect(() => {
    return () => {
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopEverything() {
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;

    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;

    localStream?.getTracks().forEach((t) => t.stop());
    remoteStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    stopSTT();
    setRecState("idle");
    setCallStarted(false);
    callStartedRef.current = false;
    pendingSignalsRef.current = [];
  }

  // ---------------- WebRTC ----------------
  async function initPeerConnection(withLocalStream: MediaStream) {
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

    withLocalStream.getTracks().forEach((t) => pc.addTrack(t, withLocalStream));
    return pc;
  }

  // ---------------- iniciar tudo (1 clique) ----------------
  async function startTele() {
    if (!roomReady) {
      setUiError("Sala ainda não pronta. Tente novamente em instantes.");
      return;
    }
    try {
      setUiError(null);

      // 1) micro/câmera com cancelamento de eco (melhor para mobile)
      const local = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        } as MediaTrackConstraints,
      });

      setLocalStream(local);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = local;
        await localVideoRef.current.play().catch(() => {});
      }

      // 2) P2P
      const pc = await initPeerConnection(local);
      setCallStarted(true);
      callStartedRef.current = true;

      const queuedOffer = pendingSignalsRef.current.find((m) => m.type === "offer") as
        | { type: "offer"; sdp: RTCSessionDescriptionInit }
        | undefined;

      if (queuedOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(queuedOffer.sdp));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        channel.send({ type: "broadcast", event: "signal", payload: { type: "answer", sdp: ans } });
      } else {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({ type: "broadcast", event: "signal", payload: { type: "offer", sdp: offer } });
      }

      for (const sig of pendingSignalsRef.current) {
        if (sig.type === "ice" && sig.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(sig.candidate)); } catch {}
        }
      }
      pendingSignalsRef.current = [];

      // 3) gravação + STT (passa o stream local por parâmetro p/ evitar race no mobile)
      await startRecording(local);
    } catch (e: any) {
      setUiError(
        e?.name === "NotAllowedError"
          ? "Permita acesso ao microfone/câmera para iniciar."
          : `Erro ao iniciar: ${e?.message || String(e)}`
      );
      stopEverything();
    }
  }

  // ---------------- Gravação ----------------
  async function startRecording(localParam?: MediaStream) {
    const baseLocal = localParam || localStream;
    if (!baseLocal) {
      setUiError("Inicie a chamada primeiro.");
      return;
    }

    // AudioContext no mobile pode começar 'suspended'
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ac: AudioContext = new AC();
    try { await (ac.state === "suspended" ? ac.resume() : Promise.resolve()); } catch {}

    const dest = ac.createMediaStreamDestination();

    // sempre conecta o micro LOCAL
    const localSrc = ac.createMediaStreamSource(baseLocal);
    localSrc.connect(dest);

    // se já tiver remoto, também conecta
    if (remoteStream) {
      try {
        const remoteSrc = ac.createMediaStreamSource(remoteStream);
        remoteSrc.connect(dest);
      } catch {}
    }

    const mixed = new MediaStream();
    dest.stream.getAudioTracks().forEach((t) => mixed.addTrack(t));

    const mr = new MediaRecorder(mixed, { mimeType: "audio/webm" });
    chunksRef.current = [];
    mr.ondataavailable = (e) => e.data && e.data.size > 0 && chunksRef.current.push(e.data);
    mr.onstop = () => setRecState("idle");
    mr.start(1000);

    recorderRef.current = mr;
    setRecState("recording");

    // STT só durante a gravação (gesto do usuário)
    startSTT();
  }

  function pauseRecording() {
    if (recState !== "recording") return;
    recorderRef.current?.pause();
    setRecState("paused");
    stopSTT();
  }

  function resumeRecording() {
    if (recState !== "paused") return;
    recorderRef.current?.resume();
    setRecState("recording");
    startSTT();
  }

  function stopRecording() {
    if (!recorderRef.current) return;
    try { recorderRef.current.stop(); } catch {}
    stopSTT();
  }

  async function uploadSaved() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size === 0) {
      setUiError("Nada gravado para enviar.");
      return;
    }
    try {
      const timestamp = ts();
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
      setUiError(`Falha ao salvar: ${e?.message || String(e)}`);
    }
  }

  // ---------------- UI ----------------
  const headerInfo = useMemo(() => `${nome} • ${cpf ?? ""}`, [nome, cpf]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-600">{headerInfo}</div>

      {uiError && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          {uiError}
        </div>
      )}

      {/* Vídeos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full aspect-video rounded-xl border" />
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full aspect-video rounded-xl border" />
      </div>

      {/* Controles principais */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
          onClick={startTele}
          disabled={callStarted || !roomReady || recState !== "idle"}
        >
          Iniciar teleconsulta (chamada + gravação)
        </button>

        {callStarted && (
          <button className="border rounded px-4 py-2" onClick={stopEverything}>
            Encerrar chamada
          </button>
        )}

        {!roomReady && <span className="text-sm text-slate-500">Conectando à sala…</span>}
      </div>

      {/* Controles de gravação */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="border px-3 py-2 rounded disabled:opacity-50"
          onClick={pauseRecording}
          disabled={recState !== "recording"}
        >
          Pausar
        </button>
        <button
          className="border px-3 py-2 rounded disabled:opacity-50"
          onClick={resumeRecording}
          disabled={recState !== "paused"}
        >
          Continuar
        </button>
        <button
          className="border px-3 py-2 rounded disabled:opacity-50"
          onClick={stopRecording}
          disabled={recState === "idle"}
          title="Interrompe a gravação (áudio fica em memória)"
        >
          Finalizar Tele-Consulta
        </button>

        <button
          className="border px-3 py-2 rounded disabled:opacity-50"
          onClick={() => alert("Áudio preparado em memória.")}
          disabled={chunksRef.current.length === 0}
          title="Prepara o blob para envio"
        >
          Preparar para salvar
        </button>
        <button
          className="bg-green-600 text-white px-3 py-2 rounded disabled:opacity-50"
          onClick={uploadSaved}
          disabled={chunksRef.current.length === 0}
        >
          Salvar Tele-consulta
        </button>

        <span className="ml-1 text-sm">Estado: {recState}</span>
      </div>

      {/* Transcrição */}
      <div>
        <h3 className="font-semibold mb-2">Transcrição (ao vivo)</h3>
        {!sttSupported && !isIOS && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
            Seu navegador pode não suportar Web Speech. Se possível, use Chrome/Edge no computador ou Android.
          </p>
        )}
        {isIOS && (
          <p className="text-xs text-slate-600 mb-2">
            iOS/Safari não suporta transcrição ao vivo. A gravação é feita normalmente e pode ser transcrita depois.
          </p>
        )}

        <textarea
          className="w-full h-60 border rounded p-2 text-sm"
          readOnly
          value={transcript}
          placeholder="A transcrição aparecerá aqui durante a gravação…"
        />
        <p className="text-xs text-slate-500">
          A transcrição usa Web Speech no navegador e só adiciona frases finais (sem duplicar parciais).
        </p>
      </div>
    </div>
  );
}
