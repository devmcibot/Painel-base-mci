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
  const [inCall, setInCall] = useState(false);

  useEffect(() => {
    const sub = channel
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const msg = payload as SignalMsg;
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
        }
      })
      .subscribe((st) => st === "SUBSCRIBED" && setRoomReady(true));

    return () => channel.unsubscribe();
  }, [channel]);

  async function startCall() {
    if (!roomReady) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] });
    pcRef.current = pc;

    const remote = new MediaStream();
    pc.ontrack = (ev) => {
      ev.streams[0].getTracks().forEach((t) => remote.addTrack(t));
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        channel.send({ type: "broadcast", event: "signal", payload: { type: "ice", candidate: ev.candidate.toJSON() } });
      }
    };

    // câmera + micro
    const local = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: { echoCancellation: true, noiseSuppression: true } as MediaTrackConstraints,
    });
    local.getTracks().forEach((t) => pc.addTrack(t, local));
    if (localVideoRef.current) localVideoRef.current.srcObject = local;

    // o médico normalmente cria a offer; se ele ainda não criou, não tem problema:
    // quando a offer chegar, faremos o answer no on("signal") acima.
    setInCall(true);
  }

  function hangup() {
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;

    const lv = localVideoRef.current?.srcObject as MediaStream | null;
    lv?.getTracks().forEach((t) => t.stop());
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    const rv = remoteVideoRef.current?.srcObject as MediaStream | null;
    rv?.getTracks().forEach((t) => t.stop());
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setInCall(false);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full aspect-video rounded-xl border" />
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full aspect-video rounded-xl border" />
      </div>

      <div className="flex gap-2 items-center">
        {!inCall ? (
          <button
            className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
            onClick={startCall}
            disabled={!roomReady}
          >
            Entrar na chamada
          </button>
        ) : (
          <button className="border rounded px-4 py-2" onClick={hangup}>
            Sair
          </button>
        )}
        {!roomReady && <span className="text-sm text-slate-500">Conectando à sala…</span>}
      </div>
    </div>
  );
}
