"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Paciente = { id: number; nome: string; cpf: string; telefone?: string | null };
type Consulta = { id: number; data: string }; // ISO string

// --- Utils
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

// ============ PÁGINA ============
export default function TeleConsultaPage() {
  const router = useRouter();
  const qs = useSearchParams();

  // Etapas: 1=seleção, 2=chamada/gravação
  const [step, setStep] = useState<1 | 2>(1);

  // Seletor
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [pacienteId, setPacienteId] = useState<number | null>(
    qs.get("pacienteId") ? Number(qs.get("pacienteId")) : null
  );
  const [consultaId, setConsultaId] = useState<number | null>(
    qs.get("consultaId") ? Number(qs.get("consultaId")) : null
  );

  // Mídia/Gravação
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null); // reservado p/ futuro (WebRTC)
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [recState, setRecState] = useState<"idle" | "recording" | "paused">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Web Speech
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [transcriptFinal, setTranscriptFinal] = useState<string>(""); // linhas finais
  const [transcriptInterim, setTranscriptInterim] = useState<string>(""); // linha provisória

  // --------- 1) Carregar opções do seletor ----------
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        // Pacientes do médico logado
        const p = await fetch("/api/medico/pacientes?limit=1000", { cache: "no-store" });
        const pdata = await p.json();
        if (!cancel) setPacientes(pdata?.items ?? []);

        if (pacienteId) {
          const r = await fetch(`/api/medico/consultas?pacienteId=${pacienteId}`, { cache: "no-store" });
          const cdata = await r.json();
          if (!cancel) setConsultas(cdata?.items ?? []);
        } else {
          setConsultas([]);
          setConsultaId(null);
        }
      } catch {
        // silencia
      }
    })();
    return () => {
      cancel = true;
    };
  }, [pacienteId]);

  // **NÃO** inicia mídia automaticamente: fica tudo parado em step 1.
  // Se a URL veio com ids, apenas pré-preenche o seletor (continua no step 1).

  // --------- 2) Lifecycle limpeza ----------
  useEffect(() => {
    return () => {
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopEverything() {
    // MediaRecorder
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    mediaRecorderRef.current = null;

    // Tracks
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    // Vídeos
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    // Reconhecimento
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    recordedChunksRef.current = [];
    setRecState("idle");
    setTranscriptInterim("");
  }

  // --------- 3) Ações (etapas) ----------
  function handleAvancar() {
    if (!pacienteId || !consultaId) return;
    // Atualiza a URL (sem recarregar) só para manter coerência, mas continua parado no step 2
    const params = new URLSearchParams();
    params.set("pacienteId", String(pacienteId));
    params.set("consultaId", String(consultaId));
    router.replace(`/medico/teleconsulta?${params.toString()}`);

    setStep(2); // apenas troca de etapa; nada inicia sozinho
  }

  async function startMediaAndRecord() {
    // Inicia câmera/mic e gravação **somente** aqui
    try {
      setErrorMsg(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      mediaStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => {});
      }

      // Gravador
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" }); // vídeo é opcional; salvamos áudio
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.start(1000);
      setRecState("recording");

      // Transcrição (Web Speech) — só cria 1x
      initRecognition();
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao acessar câmera/microfone");
      setRecState("idle");
    }
  }

  function pauseRecording() {
    if (recState !== "recording") return;
    mediaRecorderRef.current?.pause();
    recognitionRef.current?.stop(); // pausa a fala (reiniciaremos no continue)
    setRecState("paused");
  }

  function resumeRecording() {
    if (recState !== "paused") return;
    mediaRecorderRef.current?.resume();
    initRecognition(); // retoma Web Speech
    setRecState("recording");
  }

  async function stopRecording() {
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    recognitionRef.current?.stop();
    setRecState("idle");
  }

  // --------- 4) Web Speech (anti-duplicação) ----------
  function initRecognition() {
    const SR: any =
      typeof window !== "undefined" &&
      ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);
    if (!SR) return;

    const rec: SpeechRecognition = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = "";
      let finals: string[] = [];

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const text = res[0].transcript.trim();
        if (!text) continue;

        if (res.isFinal) {
          // adiciona linha final UMA vez
          finals.push(`[MEDICO] ${text}`);
        } else {
          // mantém só a última parcial (não empilha)
          interim = `[MEDICO] ${text}`;
        }
      }

      if (finals.length) {
        setTranscriptFinal((prev) => (prev ? prev + "\n" + finals.join("\n") : finals.join("\n")));
      }
      setTranscriptInterim(interim); // substitui a linha provisória
    };

    rec.onerror = (e: any) => {
      // erros de no-speech / network são comuns; apenas registra
      // console.log("rec err", e?.error);
    };

    rec.onend = () => {
      // quando paramos via pause/stop, não religa aqui
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {}
  }

  // --------- 5) Salvamento (igual Anamnese) ----------
  async function salvarAudio(prepararApenas = false) {
    if (!pacienteId || !consultaId) {
      alert("Selecione paciente e consulta.");
      return;
    }
    // junta áudio
    const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
    if (prepararApenas) {
      alert("Áudio preparado na memória (blob). Clique em 'Salvar áudio + transcrição' para enviar.");
      return;
    }

    const fd = new FormData();
    fd.append("consultaId", String(consultaId));
    fd.append("audio", blob, "teleconsulta.webm");
    fd.append("texto", transcriptFinal);

    const res = await fetch("/api/medico/anamnese", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      alert("Falha ao salvar.");
      return;
    }
    alert("Salvo com sucesso!");
  }

  // --------- 6) Derivados ----------
  const pacienteOpt = useMemo(() => pacientes.find((p) => p.id === pacienteId) || null, [pacientes, pacienteId]);

  // --------- UI ----------
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Tele-Consulta</h1>

      {step === 1 && (
        <section className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Paciente</label>
            <select
              className="w-full border rounded p-2"
              value={pacienteId ?? ""}
              onChange={(e) => setPacienteId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— selecione —</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} • {p.cpf}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Consulta</label>
            <select
              className="w-full border rounded p-2"
              value={consultaId ?? ""}
              onChange={(e) => setConsultaId(e.target.value ? Number(e.target.value) : null)}
              disabled={!pacienteId}
            >
              <option value="">— selecione um paciente primeiro —</option>
              {consultas.map((c) => (
                <option key={c.id} value={c.id}>
                  {fmtDateTime(c.data)}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <button
              className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
              onClick={handleAvancar}
              disabled={!pacienteId || !consultaId}
            >
              Avançar
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <video ref={localVideoRef} muted playsInline className="w-full aspect-video bg-black rounded" />
            <video ref={remoteVideoRef} playsInline className="w-full aspect-video bg-black rounded" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="bg-black text-white px-3 py-2 rounded disabled:opacity-50"
              onClick={startMediaAndRecord}
              disabled={recState !== "idle"}
              title="Iniciar câmera/mic e gravação"
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
              className="border px-3 py-2 rounded disabled:opacity-50"
              onClick={stopRecording}
              disabled={recState === "idle"}
            >
              Parar
            </button>

            <span className="ml-2 text-sm">Estado: {recState}</span>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Transcrição (ao vivo)</label>
            <textarea
              className="w-full border rounded p-2 h-48 font-mono text-sm"
              readOnly
              value={transcriptFinal + (transcriptInterim ? `\n${transcriptInterim}` : "")}
            />
            <p className="text-xs text-slate-500">
              Se o navegador não suportar Web Speech, a chamada funciona normalmente, apenas sem a transcrição ao vivo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="border px-3 py-2 rounded disabled:opacity-50"
              onClick={() => salvarAudio(true)}
              disabled={recordedChunksRef.current.length === 0}
              title="Prepara o blob em memória (útil para validar)"
            >
              Salvar áudio (preparar)
            </button>

            <button
              className="bg-green-600 text-white px-3 py-2 rounded disabled:opacity-50"
              onClick={() => salvarAudio(false)}
              disabled={recordedChunksRef.current.length === 0}
            >
              Salvar áudio + transcrição (enviar)
            </button>
          </div>

          <div className="pt-2">
            <button
              className="text-sm text-slate-600 underline underline-offset-4"
              onClick={() => {
                stopEverything();
                setStep(1);
              }}
            >
              ← Voltar para seleção
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
