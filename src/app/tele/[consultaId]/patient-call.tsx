// src/app/tele/[consultaId]/patient-call.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sb } from "@/lib/realtime";

type SignalMsg =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit };

export default function PatientCall({ consultaId }: { consultaId: number }) {
  const channel = useMemo(() => sb.channel(`tele-${consultaId}`), [consultaId]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [roomReady, setRoomReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const pendingSignalsRef = useRef<SignalMsg[]>([]);

  useEffect(() => {
    const sub = channel
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const msg = payload as SignalMsg;

        // se ainda não entrou, guarda offer/ice
        if (!joined) {
          if (msg.type === "offer" || msg.type === "ice") {
            pendingSignalsRef.current.push(msg);
          }
          return;
        }

        const pc = pcRef.current;
        if (!pc) return;

        try {
          if (msg.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            channel.send({
              type: "broadcast",
              event: "signal",
              payload: { type: "answer", sdp: ans },
            });
          } else if (msg.type === "ice" && msg.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
        } catch (e: any) {
          setUiError(`Erro: ${e?.message || String(e)}`);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRoomReady(true);
      });

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, joined]);

  async function join() {
    try {
      setUiError(null);

      const local = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true } as MediaTrackConstraints,
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = local;
        await localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
      });
      pcRef.current = pc;

      const remote = new MediaStream();
      pc.ontrack = (ev) => {
        ev.streams[0].getTracks().forEach((t) => remote.addTrack(t));
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: { type: "ice", candidate: ev.candidate.toJSON() },
          });
        }
      };
      local.getTracks().forEach((t) => pc.addTrack(t, local));

      setJoined(true);

      // processa sinais que chegaram antes de “join”
      for (const sig of pendingSignalsRef.current) {
        if (sig.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: { type: "answer", sdp: ans },
          });
        } else if (sig.type === "ice" && sig.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
          } catch {}
        }
      }
      pendingSignalsRef.current = [];
    } catch (e: any) {
      setUiError(
        e?.name === "NotAllowedError"
          ? "Conceda permissão de câmera e microfone para entrar."
          : `Falha ao entrar: ${e?.message || String(e)}`
      );
    }
  }

  function leave() {
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;

    const v1 = localVideoRef.current?.srcObject as MediaStream | null;
    v1?.getTracks().forEach((t) => t.stop());
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    const v2 = remoteVideoRef.current?.srcObject as MediaStream | null;
    v2?.getTracks().forEach((t) => t.stop());
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setJoined(false);
  }

  return (
    <div className="space-y-4">
      {uiError && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
          {uiError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full aspect-video rounded-xl border"
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full aspect-video rounded-xl border"
        />
      </div>

      <div className="flex items-center gap-2">
        {!joined ? (
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            onClick={join}
            disabled={!roomReady}
          >
            Entrar na consulta
          </button>
        ) : (
          <button className="border px-4 py-2 rounded" onClick={leave}>
            Sair
          </button>
        )}
        {!roomReady && (
          <span className="text-sm text-slate-500">Conectando à sala…</span>
        )}
      </div>
    </div>
  );
}
