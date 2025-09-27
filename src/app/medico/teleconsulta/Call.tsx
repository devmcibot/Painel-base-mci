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
  // Quem sou eu (rótulo de fala)
  const { data } = useSession();
  const role = (data?.user as { role?: Role } | undefined)?.role;
  const mySpeaker: "MEDICO" | "PACIENTE" =
    role === "ADMIN" || role === "MÉDICO" || role === "MEDICO" ? "MEDICO" : "PACIENTE";

  // ---- Refs/Estados principais
  const channel = useMemo(() => sb.channel(`tele-${consultaId}`), [consultaId]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [roomReady, setRoomReady] = useState(false);
  const [callStarted, setCallStarted] = useState(false);
  const callStartedRef = useRef(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Fila de sinais que chegaram antes de eu entrar
  const pendingSignalsRef = useRef<SignalMsg[]>([]);

  // Gravação
  const [recState, setRecState] = useState<"idle" | "recording" | "paused">("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Transcrição (apenas finais para evitar duplicação)
  const [transcript, setTranscript] = useState<string>("");
  const recognizerRef = useRef<SpeechRecognition | null>(null);

  const [uiError, setUiError] = useState<string | null>(null);

  // ------------------- Realtime (supabase) -------------------
  useEffect(() => {
    const sub = channel
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const msg = payload as SignalMsg;
        // Se não comecei a chamada ainda, guarda para depois
        if (!callStartedRef.current) {
          if (msg.type === "offer" || msg.type === "ice" || msg.type === "answer") {
            pendingSignalsRef.current.push(msg);
          }
          // stt final pode ser armazenado sem PC
          if (msg.type === "stt" && msg.final) {
            setTranscript((prev) => (msg.text ? prev + `\n[${msg.speaker}] ${msg.text}` : prev));
          }
          return;
        }

        // Com chamada ativa:
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

  // ------------------- Helpers de STT -------------------
  function startSTT() {
    const SR: any =
      typeof window !== "undefined" &&
      ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);
    if (!SR) {
      setTranscript((p) => p + "\n[INFO] Web Speech não disponível neste navegador.");
      return;
    }

    const rec: SpeechRecognition = new SR();
    recognizerRef.current = rec;
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const finalsToAppend: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = (r[0]?.transcript || "").trim();
        if (!text) continue;

        if (r.isFinal) {
          finalsToAppend.push(text);
          // broadcast apenas finais
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: { type: "stt", speaker: mySpeaker, text, final: true } as SignalMsg,
          });
        }
      }
      if (finalsToAppend.length) {
        setTranscript((prev) => prev + finalsToAppend.map((t) => `\n[${mySpeaker}] ${t}`).join(""));
      }
    };
    rec.onerror = () => {};
    rec.onend = () => {
      /* não reinicia automático; retomamos quando usuário quiser */
    };

    try {
      rec.start();
    } catch {}
  }

  function stopSTT() {
    try {
      recognizerRef.current?.stop();
    } catch {}
    recognizerRef.current = null;
  }

  // ------------------- Lifecycle limpeza -------------------
  useEffect(() => {
    return () => {
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopEverything() {
    // Recorder
    try {
      recorderRef.current?.stop();
    } catch {}
    recorderRef.current = null;

    // PC & mídia
    try {
      pcRef.current?.close();
    } catch {}
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

  // ------------------- Fluxo da Chamada -------------------
  async function initPeerConnection(withLocalStream: MediaStream) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });
    pcRef.current = pc;

    // Remote stream
    const remote = new MediaStream();
    setRemoteStream(remote);
    pc.ontrack = (ev) => {
      ev.streams[0].getTracks().forEach((t) => remote.addTrack(t));
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
    };

    // ICE
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        const msg: SignalMsg = { type: "ice", candidate: ev.candidate.toJSON() };
        channel.send({ type: "broadcast", event: "signal", payload: msg });
      }
    };

    // Local tracks
    withLocalStream.getTracks().forEach((t) => pc.addTrack(t, withLocalStream));

    return pc;
  }

  async function startCall() {
    if (!roomReady) {
      setUiError("Sala ainda não pronta. Tente novamente em alguns segundos.");
      return;
    }
    try {
      setUiError(null);

      // Pede permissão só agora
      const local = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(local);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = local;
        await localVideoRef.current.play().catch(() => {});
      }

      const pc = await initPeerConnection(local);

      // Marcar estado
      setCallStarted(true);
      callStartedRef.current = true;

      // Se já chegou offer antes de eu entrar → responde
      const queuedOffer = pendingSignalsRef.current.find((m) => m.type === "offer") as
        | { type: "offer"; sdp: RTCSessionDescriptionInit }
        | undefined;

      if (queuedOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(queuedOffer.sdp));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        channel.send({ type: "broadcast", event: "signal", payload: { type: "answer", sdp: ans } });
      } else {
        // Eu inicio como caller
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({ type: "broadcast", event: "signal", payload: { type: "offer", sdp: offer } });
      }

      // Reaplica ICE candidates pendentes
      for (const sig of pendingSignalsRef.current) {
        if (sig.type === "ice" && sig.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
          } catch {}
        }
      }
      pendingSignalsRef.current = [];
    } catch (e: any) {
      setUiError(
        e?.name === "NotAllowedError"
          ? "Permita acesso ao microfone/câmera para iniciar a chamada."
          : `Erro ao iniciar chamada: ${e?.message || String(e)}`
      );
      stopEverything();
    }
  }

  // ------------------- Gravação -------------------
  async function startRecording() {
    if (!localStream || !remoteStream) {
      setUiError("Inicie a chamada primeiro.");
      return;
    }

    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();

    const localSrc = ac.createMediaStreamSource(localStream);
    const remoteSrc = ac.createMediaStreamSource(remoteStream);

    localSrc.connect(dest);
    remoteSrc.connect(dest);

    const mixed = new MediaStream();
    dest.stream.getAudioTracks().forEach((t) => mixed.addTrack(t));

    const mr = new MediaRecorder(mixed, { mimeType: "audio/webm" });
    chunksRef.current = [];
    mr.ondataavailable = (e) => e.data && e.data.size > 0 && chunksRef.current.push(e.data);
    mr.onstop = () => setRecState("idle");

    mr.start(1000);
    recorderRef.current = mr;
    setRecState("recording");

    // STT começa somente quando iniciamos a gravação
    startSTT();
  }

  function pauseRecording() {
    if (recState !== "recording") return;
    recorderRef.current?.pause();
    setRecState("paused");
    stopSTT(); // pausa STT
  }

  function resumeRecording() {
    if (recState !== "paused") return;
    recorderRef.current?.resume();
    setRecState("recording");
    startSTT(); // retoma STT
  }

  async function stopAndUpload() {
    if (!recorderRef.current) return;
    try {
      recorderRef.current.stop();
    } catch {}

    stopSTT();

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size === 0) {
      setUiError("Nada gravado.");
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
      setRecState("idle");
    } catch (e: any) {
      setUiError(`Falha ao salvar: ${e?.message || String(e)}`);
    }
  }

  // ------------------- UI -------------------
  const headerInfo = useMemo(() => `${nome} • ${cpf ?? ""}`, [nome, cpf]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-600">{headerInfo}</div>

      {uiError && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          {uiError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full rounded-xl border" />
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-xl border" />
      </div>

      {/* Controles da chamada */}
      <div className="flex flex-wrap gap-2">
        {!callStarted ? (
          <button className="bg-blue-600 text-white rounded px-4 py-2" onClick={startCall} disabled={!roomReady}>
            Iniciar chamada
          </button>
        ) : (
          <button
            className="border rounded px-4 py-2"
            onClick={stopEverything}
            title="Finaliza chamada e libera câmera/mic"
          >
            Encerrar chamada
          </button>
        )}
        {!roomReady && <span className="text-sm text-slate-500">Conectando à sala…</span>}
      </div>

      {/* Controles de gravação – só após iniciar a chamada */}
      {callStarted && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="bg-black text-white px-3 py-2 rounded disabled:opacity-50"
              onClick={startRecording}
              disabled={recState !== "idle"}
            >
              Iniciar gravação
            </button>
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
              className="bg-green-600 text-white px-3 py-2 rounded disabled:opacity-50"
              onClick={stopAndUpload}
              disabled={recState === "idle"}
            >
              Parar & Salvar
            </button>
            <span className="ml-2 text-sm">Estado: {recState}</span>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Transcrição (ao vivo)</h3>
            <textarea className="w-full h-60 border rounded p-2 text-sm" value={transcript} readOnly />
            <p className="text-xs text-gray-500 mt-1">
              Para evitar duplicações, apenas frases **finais** são adicionadas e compartilhadas.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
