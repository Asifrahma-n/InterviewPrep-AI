"use client";

import { cn } from "@/lib/utils";
import React, { useCallback, useEffect, useRef, useState } from "react";

export interface WebcamAnalysisMetrics {
  dominantEmotion: string;
  attentionScore: number;
  confidenceScore: number;
  timestamp: number;
}

interface WebcamAnalyzerProps {
  isRecording: boolean;
  onAnalysis: (metrics: WebcamAnalysisMetrics) => void;
}

const POSITIVE_EMOTIONS = new Set(["happy", "neutral", "surprise"]);
const NEGATIVE_EMOTIONS = new Set(["angry", "disgust", "fear", "sad"]);

const SMOOTHING_ALPHA = 0.75;
const POSE_HISTORY_LEN = 8;
const EMOTION_HISTORY_LEN = 3;
const ANALYSIS_INTERVAL_MS = 320;

function computeAttentionScore(pitch: number, yaw: number): number {
  const pitchDeg = Math.abs(pitch) * (180 / Math.PI);
  const yawDeg = Math.abs(yaw) * (180 / Math.PI);
  const deviation = Math.min(90, pitchDeg * 1.2 + yawDeg * 1.2);
  return Math.round(Math.max(0, 100 - deviation));
}

function computeConfidenceFromEmotion(emotion: string, emotionScore: number): number {
  if (POSITIVE_EMOTIONS.has(emotion)) return 50 + Math.round(emotionScore * 50);
  if (NEGATIVE_EMOTIONS.has(emotion)) return Math.round(50 - emotionScore * 50);
  return 50;
}

/** Expression label from head pose when emotion model is unavailable */
function getExpressionFromAttention(attentionScore: number): string {
  if (attentionScore >= 80) return "engaged";
  if (attentionScore >= 60) return "focused";
  if (attentionScore >= 40) return "neutral";
  if (attentionScore >= 20) return "distracted";
  return "uncertain";
}

/** Stability score 0–100 from recent head pose variance (steady = high) */
function computeStabilityScore(history: { pitch: number; yaw: number }[]): number {
  if (history.length < 3) return 70;
  const pitchVar = variance(history.map((h) => h.pitch));
  const yawVar = variance(history.map((h) => h.yaw));
  const combinedVariance = pitchVar + yawVar;
  const maxVariance = 0.8;
  const stability = Math.max(0, 100 - (combinedVariance / maxVariance) * 100);
  return Math.round(stability);
}

function variance(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length;
}

/** Most frequent string in array (mode) for stable emotion label */
function mode(arr: string[]): string {
  if (arr.length === 0) return "neutral";
  const counts: Record<string, number> = {};
  for (const s of arr) counts[s] = (counts[s] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";
}

function ema(prev: number, next: number, alpha: number): number {
  return prev + alpha * (next - prev);
}

export function WebcamAnalyzer({ isRecording, onAnalysis }: WebcamAnalyzerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const humanRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const poseHistoryRef = useRef<{ pitch: number; yaw: number }[]>([]);
  const emotionHistoryRef = useRef<string[]>([]);
  const smoothedRef = useRef({ attention: 50, confidence: 50 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState<WebcamAnalysisMetrics | null>(null);

  const runAnalysis = useCallback(async () => {
    const video = videoRef.current;
    const human = humanRef.current;
    if (!video || !human || video.readyState < 2) return;

    try {
      await human.detect(video);
      const faces = human.result?.face ?? [];
      const face = faces[0];
      if (!face) {
        const fallback = {
          dominantEmotion: "neutral",
          attentionScore: 0,
          confidenceScore: 50,
          timestamp: Date.now(),
        };
        if (isRecording) onAnalysis(fallback);
        setLiveStats(fallback);
        return;
      }

      const rotation = face.rotation?.angle;
      const pitch = rotation?.pitch ?? 0;
      const yaw = rotation?.yaw ?? 0;

      const rawAttention = computeAttentionScore(pitch, yaw);
      const history = poseHistoryRef.current;
      history.push({ pitch, yaw });
      if (history.length > POSE_HISTORY_LEN) history.shift();
      const stabilityScore = computeStabilityScore(history);

      const emotions = face.emotion ?? [];
      const dominant = emotions.length
        ? emotions.reduce((a: any, b: any) => (a.score >= b.score ? a : b), emotions[0])
        : null;

      let rawEmotionLabel: string;
      let emotionComponent: number;

      if (dominant?.emotion) {
        rawEmotionLabel = dominant.emotion;
        emotionComponent = computeConfidenceFromEmotion(
          rawEmotionLabel,
          dominant.score ?? 0.5
        );
      } else {
        rawEmotionLabel = getExpressionFromAttention(rawAttention);
        emotionComponent = Math.round(50 + rawAttention * 0.5);
      }

      const emotionHistory = emotionHistoryRef.current;
      emotionHistory.push(rawEmotionLabel);
      if (emotionHistory.length > EMOTION_HISTORY_LEN) emotionHistory.shift();
      const dominantEmotionForFeedback = mode(emotionHistory);

      const rawConfidence = Math.round(
        Math.min(
          100,
          Math.max(
            0,
            0.35 * rawAttention + 0.25 * stabilityScore + 0.4 * (emotionComponent / 100) * 100
          )
        )
      );

      const prev = smoothedRef.current;
      const attentionSmoothed = Math.round(ema(prev.attention, rawAttention, SMOOTHING_ALPHA));
      const confidenceSmoothed = Math.round(ema(prev.confidence, rawConfidence, SMOOTHING_ALPHA));
      smoothedRef.current = { attention: attentionSmoothed, confidence: confidenceSmoothed };

      const metricsForFeedback = {
        dominantEmotion: dominantEmotionForFeedback,
        attentionScore: Math.max(0, Math.min(100, attentionSmoothed)),
        confidenceScore: Math.max(0, Math.min(100, confidenceSmoothed)),
        timestamp: Date.now(),
      };
      if (isRecording) onAnalysis(metricsForFeedback);

      setLiveStats({
        dominantEmotion: rawEmotionLabel,
        attentionScore: Math.max(0, Math.min(100, rawAttention)),
        confidenceScore: Math.max(0, Math.min(100, rawConfidence)),
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn("WebcamAnalyzer runAnalysis error", e);
    }
  }, [onAnalysis, isRecording]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Human = (await import("@vladmandic/human")).default;
        const human = new Human({
          modelBasePath: "/models",
          debug: false,
          face: {
            enabled: true,
            detector: { enabled: true, maxDetected: 1 },
            mesh: { enabled: true },
            emotion: { enabled: true },
            iris: { enabled: true },
          },
          body: { enabled: false },
          hand: { enabled: false },
          gesture: { enabled: false },
          object: { enabled: false },
        });
        await human.warmup();
        if (cancelled) return;
        humanRef.current = human;
      } catch (e) {
        if (!cancelled) setError("Failed to load AI models.");
        console.error("Human init error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const mediaDevices =
      typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!mediaDevices?.getUserMedia) {
      setError(
        "Camera not available. Use HTTPS or localhost, and allow camera access."
      );
      return;
    }

    mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        video.srcObject = stream;
        video.onloadedmetadata = () => setReady(true);
      })
      .catch((e) => {
        setError("Camera access denied.");
        console.error("getUserMedia error", e);
      });

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video.srcObject) video.srcObject = null;
    };
  }, []);

  // Run analysis whenever camera is ready so live stats show even before call starts
  useEffect(() => {
    if (!ready || !humanRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(runAnalysis, ANALYSIS_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [ready, runAnalysis]);

  // Only clear live stats when camera is off; keep last values visible when call ends
  useEffect(() => {
    if (error) setLiveStats(null);
  }, [error]);

  if (error) {
    return (
      <div className="flex aspect-video max-h-[400px] w-full max-w-2xl items-center justify-center rounded-2xl border-2 border-destructive-100/30 bg-dark-200 p-6 text-destructive-100">
        {error}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border-2 bg-dark-200 shadow-xl",
        "ring-offset-2 ring-offset-dark-100",
        isRecording
          ? "border-success-100/60 shadow-success-100/20 ring-2 ring-success-100/40"
          : "border-primary-200/40",
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="h-full w-full scale-x-[-1] object-cover"
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-300 text-light-100">
          Starting camera…
        </div>
      )}
      {ready && !liveStats && (
        <div className="absolute bottom-3 left-3 rounded-xl bg-dark-100/90 px-3 py-2 text-xs text-white/90 backdrop-blur-sm">
          Analyzing expression…
        </div>
      )}
      {isRecording && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-dark-100/90 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success-100" />
          AI Analyzing Body Language
        </div>
      )}
      {liveStats && (
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-3 rounded-xl bg-dark-100/95 px-4 py-2.5 text-sm backdrop-blur-sm">
          <span className="flex items-center gap-1.5 font-medium text-white">
            <span className="text-white/70">Confidence</span>
            <span className="min-w-[2.5rem] tabular-nums text-success-100">{liveStats.confidenceScore}%</span>
          </span>
          <span className="h-4 w-px bg-white/20" aria-hidden />
          <span className="flex items-center gap-1.5 font-medium text-white">
            <span className="text-white/70">Eye contact</span>
            <span className="min-w-[2.5rem] tabular-nums text-primary-200">{liveStats.attentionScore}%</span>
          </span>
          <span className="h-4 w-px bg-white/20" aria-hidden />
          <span className="flex items-center gap-1.5 font-medium text-white">
            <span className="text-white/70">Expression</span>
            <span className="capitalize text-white">{liveStats.dominantEmotion}</span>
          </span>
        </div>
      )}
    </div>
  );
}

export default WebcamAnalyzer;
