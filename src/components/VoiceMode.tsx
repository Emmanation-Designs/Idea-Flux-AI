import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Headphones, Volume2, Mic, MicOff, AlertCircle, Sparkles, MessageSquareDot, HelpCircle } from "lucide-react";
import { useVoiceMode, VoiceModeStatus } from "../hooks/useVoiceMode";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  voiceOption: string;
  onSaveMessagePair?: (userText: string, assistantText: string) => void;
  profile: any;
}

export function VoiceMode({ isOpen, onClose, voiceOption, onSaveMessagePair, profile }: VoiceModeOverlayProps) {
  const {
    status,
    error,
    userTranscript,
    assistantTranscript,
    connect,
    disconnect
  } = useVoiceMode({ voiceOption, onSaveMessagePair });

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-connect when voice mode overlay is opened
  useEffect(() => {
    if (isOpen) {
      connect();
    } else {
      disconnect();
    }
    return () => {
      disconnect();
    };
  }, [isOpen, connect, disconnect]);

  // Keep transcripts scrolled to the bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [userTranscript, assistantTranscript]);

  if (!isOpen) return null;

  // Visual status mapping for names, states, and colors
  const statusConfig: Record<VoiceModeStatus, { label: string; description: string; color: string; orbAnimation: any }> = {
    disconnected: {
      label: "Disconnected",
      description: "Audio connection closed.",
      color: "text-zinc-400 bg-zinc-400/20",
      orbAnimation: { scale: 0.8, rotate: 0, opacity: 0.5 }
    },
    connecting: {
      label: "Contacting Trelvix Engine",
      description: "Allocating highly secure ephemeral WebRTC node...",
      color: "text-amber-400 bg-amber-400/20 animate-pulse",
      orbAnimation: {
        scale: [1, 1.15, 1],
        rotate: 360,
        transition: { repeat: Infinity, duration: 4, ease: "linear" }
      }
    },
    listening: {
      label: "Listening",
      description: "Go ahead, speak naturally with Trelvix.",
      color: "text-emerald-400 bg-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.3)]",
      orbAnimation: {
        scale: [1, 1.2, 1],
        borderRadius: ["50%", "45% 55% 52% 48% / 48% 52% 45% 55%", "50%"],
        transition: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
      }
    },
    thinking: {
      label: "Thinking",
      description: "Trelvix is processing with custom neural engines...",
      color: "text-sky-400 bg-sky-400/20 shadow-[0_0_15px_rgba(56,189,248,0.3)]",
      orbAnimation: {
        scale: [1.1, 0.95, 1.1],
        rotate: -360,
        borderRadius: "50%",
        transition: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
      }
    },
    speaking: {
      label: "Trelvix Speaking",
      description: "Streaming direct low-latency voice responses...",
      color: "text-indigo-400 bg-indigo-400/20 shadow-[0_0_20px_rgba(129,140,248,0.4)]",
      orbAnimation: {
        scale: [1, 1.35, 0.95, 1.25, 1],
        borderRadius: ["53% 47% 41% 59% / 55% 44% 56% 45%", "45% 55% 52% 48% / 48% 52% 45% 55%", "50%"],
        transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" }
      }
    },
    interrupted: {
      label: "Interrupted",
      description: "Resetting context & cancelling ongoing generator...",
      color: "text-rose-400 bg-rose-400/20",
      orbAnimation: {
        scale: [1.15, 0.9],
        borderRadius: "45%",
        transition: { duration: 0.3 }
      }
    },
    reconnecting: {
      label: "Reconnecting",
      description: "Experiencing minor network gap. Stablizing signal...",
      color: "text-purple-400 bg-purple-400/20 animate-pulse",
      orbAnimation: {
        scale: [0.9, 1.1, 0.9],
        rotate: 180,
        transition: { repeat: Infinity, duration: 2, ease: "linear" }
      }
    }
  };

  const currentConfig = statusConfig[status] || statusConfig.disconnected;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-zinc-950/95 p-6 backdrop-blur-xl md:p-12 text-white"
      >
        {/* Top Premium Bar Header */}
        <div className="flex w-full items-center justify-between max-w-4xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800">
              <Headphones className="h-5 w-5 text-zinc-300 animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-zinc-100 uppercase tracking-wider">Trelvix Voice Companion</h2>
                <div className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <p className="text-xs text-zinc-400">Stream: <span className="font-semibold text-zinc-200 capitalize">{voiceOption}</span></p>
            </div>
          </div>

          <button
            onClick={() => {
              disconnect();
              onClose();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Close Voice Mode"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Center: Glowing Swirling Audio Orb Section */}
        <div className="flex flex-col items-center justify-center w-full max-w-lg select-none">
          <div className="relative flex items-center justify-center h-72 w-72 mb-8">
            
            {/* Ambient Outer Ring Gradient */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500/20 via-sky-500/10 to-teal-500/20 blur-3xl opacity-80" />

            {/* Glowing Pulsating Rings around the main orb */}
            {status !== "disconnected" && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full border border-zinc-800/60"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute -inset-4 rounded-full border border-indigo-500/10"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.0, 0.3] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 }}
                />
              </>
            )}

            {/* Main Interactive Animated Sound Orb */}
            <motion.div
              animate={currentConfig.orbAnimation}
              className={cn(
                "relative flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 via-sky-700 to-teal-500 shadow-2xl transition-all duration-300",
                status === "speaking" && "from-emerald-600 via-sky-600 to-indigo-600",
                status === "thinking" && "from-sky-700 via-indigo-700 to-purple-600",
                status === "interrupted" && "from-rose-600 to-zinc-800"
              )}
            >
              {/* Core Inner Glow */}
              <div className="absolute inset-3 rounded-full bg-zinc-950/80 flex flex-col items-center justify-center border border-white/5 backdrop-blur-md">
                {status === "connecting" && (
                  <Sparkles className="h-10 w-10 text-amber-400 animate-spin" />
                )}
                {status === "listening" && (
                  <Mic className="h-12 w-12 text-emerald-400" />
                )}
                {status === "thinking" && (
                  <div className="flex space-x-1.5 items-center justify-center">
                    <span className="h-3 w-3 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-3 w-3 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-3 w-3 bg-purple-400 rounded-full animate-bounce" />
                  </div>
                )}
                {status === "speaking" && (
                  <Volume2 className="h-12 w-12 text-indigo-400 animate-pulse" />
                )}
                {status === "interrupted" && (
                  <MicOff className="h-10 w-10 text-rose-400" />
                )}
                {status === "disconnected" && (
                  <Headphones className="h-10 w-10 text-zinc-500" />
                )}
              </div>
            </motion.div>
          </div>

          {/* Status Label & Custom Indicator */}
          <div className="flex flex-col items-center text-center">
            <span className={cn("px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase transition-colors duration-300", currentConfig.color)}>
              {currentConfig.label}
            </span>
            <p className="mt-4 text-sm text-zinc-400 font-medium max-w-sm leading-relaxed">
              {currentConfig.description}
            </p>
          </div>
        </div>

        {/* Live Conversation Autoscrolling Transcript Reader */}
        <div className="w-full max-w-2xl h-48 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-start overflow-y-auto backdrop-blur-md shadow-inner">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/60 mb-3 text-zinc-400">
            <MessageSquareDot className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Live Transcript Stream</span>
          </div>

          <div className="space-y-3.5 pr-2 flex-grow overflow-y-auto">
            {(!userTranscript && !assistantTranscript) ? (
              <p className="text-xs text-zinc-500 italic text-center py-6">Your spoken words and response streams will appear live here.</p>
            ) : (
              <>
                {userTranscript && (
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Spoken Text</span>
                    <p className="text-sm text-zinc-300 leading-normal bg-zinc-900/50 px-3.5 py-2 rounded-xl rounded-tl-none border border-zinc-800/50 max-w-[90%] break-all">
                      {userTranscript.replace(/^User:\s*/i, "")}
                    </p>
                  </div>
                )}
                {assistantTranscript && (
                  <div className="flex flex-col items-start gap-1 mt-2">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Trelvix AI</span>
                    <p className="text-sm text-zinc-200 leading-relaxed bg-indigo-950/20 px-3.5 py-2 rounded-xl rounded-tl-none border border-indigo-900/20 max-w-[90%]">
                      {assistantTranscript}
                    </p>
                  </div>
                )}
              </>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Footer actions and warnings */}
        <div className="flex flex-col items-center gap-4 w-full">
          {error && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-950/40 border border-rose-800/40 text-rose-300 rounded-xl text-xs max-w-xl text-center"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="flex items-center gap-4">
            {status === "disconnected" ? (
              <button
                onClick={connect}
                className="px-6 py-3 rounded-full font-bold bg-indigo-600 hover:bg-indigo-500 text-sm shadow-xl hover:shadow-indigo-500/20 transition-all flex items-center gap-2"
              >
                <Mic className="h-4 w-4" />
                Reconnect Session
              </button>
            ) : (
              <button
                onClick={() => {
                  disconnect();
                  onClose();
                }}
                className="px-8 py-3.5 rounded-full font-extrabold bg-rose-600 hover:bg-rose-500 text-sm shadow-xl hover:shadow-rose-600/30 transition-all flex items-center gap-2.5 antialiased uppercase tracking-widest"
              >
                <X className="h-4 w-4" />
                Disconnect
              </button>
            )}
          </div>

          <p className="text-[10px] text-zinc-500 max-w-xs text-center leading-normal">
            Microphone stays listening continuously. You can interrupt Trelvix at any time simply by responding.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
