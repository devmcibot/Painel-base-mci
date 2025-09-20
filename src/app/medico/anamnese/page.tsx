"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** ===== Tipos base só para a tela ===== */
type ConsultaItem = {
  id: number;
  data: string; // ISO
  pastaPath: string | null;
  pacienteId: number;
  pacienteNome: string;
  pacienteCpf: string | null;
};

type PacienteItem = {
  id: number;
  nome: string;
  cpf: string | null;
};

/** Pega o construtor do Web Speech sem usar `window` como tipo */
function getRecognitionCtor(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function AnamnesePage() {
  /** ===== estado de pacientes/consultas (carregado via API simples) ===== */
  const [consultas, setConsultas] = useState<ConsultaItem[]>([]);
  const [pacientes, setPacientes] = useState<PacienteItem[]>([]);
  const [pacienteId, setPacienteId] = useState<number | "">("");
  const [consultaId, setConsultaId] = useState<number | "">("");

  /** Deriva consultas do paciente */
  const consultasDoPaciente = useMemo(
    () => consultas.filter((c) => c.pacienteId === (pacienteId || -1)),
    [consultas, pacienteId]
  );

  const consultaSelecionada = useMemo(
    () => consultas.find((c) => c.id === consultaId) || null,
    [consultas, consultaId]
  );

  /** ===== Gravação (MediaRecorder) ===== */
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recState, setRecState] = useState<"idle" | "recording" | "paused">(
    "idle"
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /** ===== Transcrição (Web Speech) ===== */
  const recognitionRef = useRef<any | null>(null);
  const [textLive, setTextLive] = useState("");
  const stableRef = useRef<string>(""); // finais (para não repetir)
  const recStateRef = useRef(recState);
  useEffect(() => {
    recStateRef.current = recState;
  }, [recState]);

  /** Carrega dados mínimos */
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/medico/consultas", { cache: "no-store" });
      const list = (await res.json()) as any[];

      const cons: ConsultaItem[] = list.map((c) => ({
        id: c.id,
        data: c.data, // ISO
        pastaPath: c.pastaPath ?? null,
        pacienteId: c.paciente.id,
        pacienteNome: c.paciente.nome,
        pacienteCpf: c.paciente.cpf ?? null,
      }));
      setConsultas(cons);

      const mapa = new Map<number, PacienteItem>();
      cons.forEach((c) => {
        if (!mapa.has(c.pacienteId)) {
          mapa.set(c.pacienteId, {
            id: c.pacienteId,
            nome: c.pacienteNome,
            cpf: c.pacienteCpf,
          });
        }
      });
      setPacientes(
        Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome))
      );
    };
    load();
  }, []);

  /** Ao trocar o paciente, seleciona a primeira consulta dele */
  useEffect(() => {
    if (!pacienteId) {
      setConsultaId("");
      return;
    }
    const primeira = consultasDoPaciente[0]?.id ?? "";
    setConsultaId(primeira);
  }, [pacienteId, consultasDoPaciente]);

  /** Timer */
  function startTimer() {
    stopTimer();
    timerRef.current = setInterval(() => setElapsedMs((v) => v + 1000), 1000);
  }
  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  /** MediaRecorder */
  async function ensureMedia(): Promise<MediaRecorder> {
    if (mediaRef.current) return mediaRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mr.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioBlob(blob);
    };
    mediaRef.current = mr;
    return mr;
  }

  /** Web Speech (anti-repetição) */
  function setupRecognition() {
    const RecCtor = getRecognitionCtor();
    if (!RecCtor) {
      console.warn("Web Speech API não disponível.");
      return;
    }
    if (recognitionRef.current) return;

    const rec = new RecCtor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const txt = (res[0]?.transcript || "").trim();
        if (res.isFinal) {
          if (stableRef.current && !stableRef.current.endsWith(" "))
            stableRef.current += " ";
          stableRef.current += txt;
        } else {
          interim += (interim ? " " : "") + txt;
        }
      }
      setTextLive((stableRef.current + (interim ? " " + interim : "")).trim());
    };

    rec.onend = () => {
      if (recStateRef.current === "recording") {
        try {
          rec.start();
        } catch {}
      }
    };

    recognitionRef.current = rec;
  }

  function startRecognition() {
    setupRecognition();
    try {
      recognitionRef.current?.start();
    } catch {}
  }

  function stopRecognition() {
    const rec = recognitionRef.current as any;
    if (!rec) return;
    try {
      rec.onresult = null;
      rec.onend = null;
      rec.stop();
    } catch {}
    recognitionRef.current = null;
  }

  /** Controles */
  async function onStart() {
    try {
      setAudioBlob(null);
      chunksRef.current = [];

      const mr = await ensureMedia();
      mr.start(1000);
      setRecState("recording");
      setElapsedMs(0);
      startTimer();

      stableRef.current = "";
      setTextLive("");
      startRecognition();
    } catch (e) {
      console.error(e);
      alert("Não foi possível iniciar a gravação (microfone?).");
    }
  }

  function onPause() {
    if (mediaRef.current && recState === "recording") {
      mediaRef.current.pause();
      setRecState("paused");
      stopTimer();
      stopRecognition();
    }
  }

  function onResume() {
    if (mediaRef.current && recState === "paused") {
      mediaRef.current.resume();
      setRecState("recording");
      startTimer();
      startRecognition();
    }
  }

  async function onSavePrepare() {
    if (!mediaRef.current) return;
    try {
      mediaRef.current.requestData();
      mediaRef.current.stop();
      setRecState("idle");
      stopTimer();
      stopRecognition();

      setTimeout(() => {
        if (audioBlob) {
          alert(
            `Áudio pronto! Tamanho: ${(audioBlob.size / 1024).toFixed(
              1
            )} KB\n(Upload vem no próximo passo)`
          );
        } else {
          alert(
            "Áudio finalizando… (se não aparecer, clique de novo em alguns segundos)"
          );
        }
      }, 300);
    } catch (e) {
      console.error(e);
      alert("Falha ao finalizar a gravação.");
    }
  }

  /** Envia áudio + texto para a API e salva no Storage */
  async function onUpload() {
    if (!audioBlob || !consultaSelecionada) {
      alert("Finalize o áudio e selecione a consulta.");
      return;
    }
    if (!consultaSelecionada.pastaPath) {
      alert("Consulta sem pasta (pastaPath).");
      return;
    }

    try {
      const fd = new FormData();
      // a rota espera estes campos:
      fd.append("pastaPath", consultaSelecionada.pastaPath);
      fd.append("pacienteNome", consultaSelecionada.pacienteNome || "");
      fd.append("pacienteCpf", consultaSelecionada.pacienteCpf || "");
      fd.append("audio", audioBlob, "audio.webm");
      fd.append("text", textLive || "");

      const res = await fetch("/api/medico/anamnese", {
        method: "POST",
        body: fd,
      });
      const j = await res.json();

      if (!res.ok) {
        console.error(j);
        alert(j?.error || "Falha ao salvar anamnese.");
        return;
      }

      alert("Anamnese salva com sucesso!");
      // Opcional: limpar/ir para a tela de arquivos
      // setTextLive(""); setAudioBlob(null);
      // location.href = "/medico/arquivo";
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao enviar anamnese.");
    }
  }

  /** Helpers UI */
  function fmtBr(dtIso: string) {
    const d = new Date(dtIso);
    const data = d.toLocaleDateString("pt-BR");
    const hora = d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${data}, ${hora}`;
  }

  const podeIniciar = pacienteId && consultaId;
  const pastaPath = consultaSelecionada?.pastaPath ?? "";
  const hhmmss = new Date(elapsedMs).toISOString().substring(11, 19);

  return (
    <div className="">
      <div className="mb-2">
        <a href="/medico" className="underline">
          &larr; Voltar
        </a>
      </div>

      <h1 className="text-xl font-semibold">Anamnese</h1>

      {/* Paciente */}
      <div className="space-y-2">
        <label className="text-sm">Paciente</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={pacienteId}
          onChange={(e) =>
            setPacienteId(e.target.value ? Number(e.target.value) : "")
          }
        >
          <option value="">— selecione um paciente —</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} {p.cpf ? `(${p.cpf})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Consulta */}
      <div className="space-y-2">
        <label className="text-sm">Consulta</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={consultaId}
          onChange={(e) =>
            setConsultaId(e.target.value ? Number(e.target.value) : "")
          }
          disabled={!pacienteId}
        >
          <option value="">— selecione um paciente primeiro —</option>
          {consultasDoPaciente.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.id} • {fmtBr(c.data)}
            </option>
          ))}
        </select>
        {pastaPath ? (
          <p className="text-xs">Pasta da consulta: {pastaPath}</p>
        ) : (
          consultaId && (
            <p className="text-xs text-amber-700">
              (Esta consulta ainda não tem pasta. Crie a consulta pela listagem
              padrão.)
            </p>
          )
        )}
      </div>

      {/* Controles de gravação */}
      <div className="border rounded p-3 space-y-3">
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={onStart}
            disabled={!podeIniciar || recState === "recording"}
            className="px-3 py-2 rounded border disabled:opacity-50"
          >
            Iniciar gravação
          </button>

          <button
            onClick={onPause}
            disabled={recState !== "recording"}
            className="px-3 py-2 rounded border disabled:opacity-50"
          >
            Pausar
          </button>

          <button
            onClick={onResume}
            disabled={recState !== "paused"}
            className="px-3 py-2 rounded border disabled:opacity-50"
          >
            Continuar
          </button>

          <button
            onClick={onSavePrepare}
            disabled={recState !== "paused" && recState !== "recording"}
            className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            Salvar áudio (preparar)
          </button>

          <button
            onClick={onUpload}
            disabled={!audioBlob || !consultaId}
            className="px-3 py-2 rounded border disabled:opacity-50"
            title={!audioBlob ? "Finalize o áudio primeiro" : ""}
          >
            Salvar áudio + transcrição (enviar)
          </button>

          <span className="ml-2 text-sm">
            Estado: <b>{recState}</b> • {hhmmss}
          </span>
        </div>

        <div className="space-y-1 w-full">
          <label className="text-sm">Transcrição (ao vivo)</label>
          <textarea
            className="w-full border rounded p-2 min-h-[180px]"
            placeholder="A transcrição aparecerá aqui durante a gravação…"
            value={textLive}
            onChange={(e) => setTextLive(e.target.value)}
          />
        </div>

        {audioBlob && (
          <p className="text-xs">
            Áudio pronto na memória ({(audioBlob.size / 1024).toFixed(1)} KB).
            Upload vem no próximo passo.
          </p>
        )}
      </div>
    </div>
  );
}
