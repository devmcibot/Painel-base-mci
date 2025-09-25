"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sb } from "@/lib/realtime";
import { ensureConsultaFolder, uploadTextFile } from "@/lib/storage";

// ===== Helpers para nomes de arquivos =====
function ts() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

type SignalMsg =
  | { type: "offer"; sdp: any }
  | { type: "answer"; sdp: any }
  | { type: "ice"; candidate: any }
  | { type: "stt"; speaker: "MEDICO" | "PACIENTE"; text: string; final: boolean };

export default function Call({ pacienteId, consultaId }: { pacienteId: number; consultaId: number }) {
  const [roomReady, setRoomReady] = useState(false);
  const [isCaller, setIsCaller] = useState<boolean | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [transcript, setTranscript] = useState<string>("");

  // Channel do Supabase Realtime para essa consulta
  const channel = useMemo(() => sb.channel(`tele-${consultaId}`), [consultaId]);

  // ====== SINALIZAÇÃO VIA SUPABASE REALTIME ======
  useEffect(() => {
    channel
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        const msg = payload as SignalMsg;
        const pc = pcRef.current;
        if (!pc) return;

        if (msg.type === "offer") {
          pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)).then(async () => {
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            channel.send({ type: "broadcast", event: "signal", payload: { type: "answer", sdp: ans } });
          });
        } else if (msg.type === "answer") {
          pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        } else if (msg.type === "ice" && msg.candidate) {
          pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } else if (msg.type === "stt") {
          // chegou trecho de transcrição do outro lado
          setTranscript(prev => prev + `\n[${msg.speaker}] ${msg.text}`);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRoomReady(true);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [channel]);

  // ====== SETUP WEBRTC ======
  useEffect(() => {
    if (!roomReady) return;

    const pc = new RTCPeerConnection({
      // STUN público; para produção, adicione TURN se precisar
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });
    pcRef.current = pc;

    // recepção de trilhas remotas
    const remote = new MediaStream();
    setRemoteStream(remote);
    pc.ontrack = (ev) => {
      ev.streams[0].getTracks().forEach((t) => remote.addTrack(t));
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remote;
      }
    };

    // enviar candidatos
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        const msg: SignalMsg = { type: "ice", candidate: ev.candidate };
        channel.send({ type: "broadcast", event: "signal", payload: msg });
      }
    };

    // pegar câmera/mic local
    (async () => {
      const local = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(local);
      local.getTracks().forEach((t) => pc.addTrack(t, local));
      if (localVideoRef.current) localVideoRef.current.srcObject = local;

      // Decide quem chama: o primeiro a clicar "Start" pode enviar OFFER
      setIsCaller(true);
    })();

    return () => {
      pc.close();
      pcRef.current = null;
    };
  }, [roomReady]);

  // se sou caller, crio e envio OFFER
  useEffect(() => {
    (async () => {
      if (!roomReady) return;
      if (isCaller !== true) return;
      const pc = pcRef.current;
      if (!pc) return;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const msg: SignalMsg = { type: "offer", sdp: offer };
      channel.send({ type: "broadcast", event: "signal", payload: msg });
    })();
  }, [roomReady, isCaller, channel]);

  // ====== TRANSCRIÇÃO LOCAL (Web Speech) ======
  useEffect(() => {
    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        const final = r.isFinal;

        // atualiza tela local
        setTranscript(prev => prev + `\n[MEDICO] ${text}`);

        // envia para o outro lado
        const msg: SignalMsg = { type: "stt", speaker: "MEDICO", text, final };
        channel.send({ type: "broadcast", event: "signal", payload: msg });
      }
    };
    rec.onerror = () => {/* ignore MVP */};
    rec.start();

    return () => rec.stop();
  }, [channel]);

  // ====== GRAVAÇÃO (mixar local+remoto) ======
  async function startRecording() {
    if (!localStream || !remoteStream) return;

    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();

    const localSource = ac.createMediaStreamSource(localStream);
    localSource.connect(dest);

    const remoteSource = ac.createMediaStreamSource(remoteStream);
    remoteSource.connect(dest);

    const mixed = new MediaStream();
    dest.stream.getAudioTracks().forEach(t => mixed.addTrack(t));

    const mr = new MediaRecorder(mixed, { mimeType: "audio/webm" });
    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start();
    recorderRef.current = mr;
    setRecording(true);
  }

  async function stopAndUpload() {
    if (!recorderRef.current) return;
    recorderRef.current.stop();

    const onStop = async () => {
      setRecording(false);

      // junta blobs -> webm
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const fileName = `tele_${ts()}.webm`;
      const txtName  = `tele_transcricao_${ts()}.txt`;

      // 1) garante subpasta da consulta
      const folder = await ensureConsultaFolder({
        medicoId: 0,              // se tiver o medicoId na sessão, passe-o aqui
        pacienteId,
        nome: "paciente",         // se tiver nome, passe aqui; para MVP qualquer string
        cpf: null,
        consultaId,
        data: new Date(),
      });

      // 2) upload do áudio
      const fullAudioPath = `${folder}/${fileName}`;
      const buf = Buffer.from(await blob.arrayBuffer());
      const { supabaseAdmin } = await import("@/lib/supabase"); // lazy import
      const { error: upErr } = await supabaseAdmin
        .storage
        .from(process.env.STORAGE_BUCKET || process.env.SUPABASE_BUCKET!)
        .upload(fullAudioPath, buf, { contentType: "audio/webm", upsert: true });
      if (upErr) throw upErr;

      // 3) upload do texto
      const fullTxtPath = `${folder}/${txtName}`;
      await uploadTextFile(fullTxtPath, transcript);

      alert("Gravação e transcrição salvas na pasta da consulta!");
    };

    // aguarda evento 'stop' encerrar gravação
    recorderRef.current.onstop = onStop;
  }

  return (
    <div className="space-y-4">
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
        <textarea
          className="w-full h-60 border rounded p-2 text-sm"
          value={transcript}
          onChange={() => {}}
        />
        <p className="text-xs text-gray-500 mt-1">
          Os trechos de ambos os lados são reunidos aqui via Realtime.
        </p>
      </div>
    </div>
  );
}
