"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";
import { toast } from "sonner";
import type { WebcamAnalysisMetrics } from "@/components/WebcamAnalyzer";

const WebcamAnalyzer = dynamic(
  () => import("@/components/WebcamAnalyzer").then((m) => m.default),
  { ssr: false },
);

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

export interface AveragedVisualMetrics {
  averageConfidence: number;
  averageAttention: number;
  dominantEmotion: string;
}

const Agent = ({
  userName,
  userId,
  type,
  interviewId,
  questions,
}: AgentProps) => {
  const router = useRouter();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const visualMetricsRef = useRef<WebcamAnalysisMetrics[]>([]);
  const callStartTimeRef = useRef<number>(0);
  const callEndTimeRef = useRef<number>(0);

  const handleVisualAnalysis = useCallback((metrics: WebcamAnalysisMetrics) => {
    visualMetricsRef.current.push(metrics);
  }, []);

  useEffect(() => {
    const onCallStart = () => {
      visualMetricsRef.current = [];
      callStartTimeRef.current = Date.now();
      setCallStatus(CallStatus.ACTIVE);
    };
    const onCallEnd = () => {
      callEndTimeRef.current = Date.now();
      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };

        setMessages((prev) => [...prev, newMessage]);
      }
    };

    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);

    const onError = (error: Error) => console.log("Error", error);

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, []);

  function getAveragedVisualMetrics(): AveragedVisualMetrics | undefined {
    const arr = visualMetricsRef.current;
    if (!arr.length) return undefined;
    const sumConfidence = arr.reduce((a, m) => a + m.confidenceScore, 0);
    const sumAttention = arr.reduce((a, m) => a + m.attentionScore, 0);
    const emotionCounts: Record<string, number> = {};
    for (const m of arr) {
      emotionCounts[m.dominantEmotion] = (emotionCounts[m.dominantEmotion] ?? 0) + 1;
    }
    const dominantEmotion =
      Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";
    return {
      averageConfidence: Math.round(sumConfidence / arr.length),
      averageAttention: Math.round(sumAttention / arr.length),
      dominantEmotion,
    };
  }

  const handleGenerateFeedback = async (messages: SavedMessage[]) => {
    const visualMetrics = getAveragedVisualMetrics();
    const endTime = callEndTimeRef.current || Date.now();
    const startTime = callStartTimeRef.current || endTime;
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    const result = await createFeedback({
      interviewId: interviewId!,
      userId: userId!,
      transcript: messages,
      questions: questions ?? undefined,
      visualMetrics,
      durationSeconds,
    });

    if (result.success && result.feedbackId) {
      router.push(`/interview/${interviewId}/feedback`);
    } else {
      const message = result.error ?? "Error saving feedback.";
      console.error("Error saving feedback", message);
      toast.error(message);
      router.push("/");
    }
  };

  useEffect(() => {
    if (callStatus === CallStatus.FINISHED && messages.length > 0) {
      if (type === "generate") {
        router.push("/");
      } else {
        handleGenerateFeedback(messages);
      }
    }
  }, [messages, callStatus, type, userId]);

  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);

    // "generate" = legacy voice-based setup (Vapi workflow). "interview" = option-based setup + Vapi for voice only.
    if (type === "generate") {
      await vapi.start(
        undefined,
        undefined,
        undefined,
        process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!,
        {
          variableValues: {
            username: userName,
            userid: userId,
          },
        },
      );
    } else {
      let formattedQuestions = "";

      if (questions) {
        formattedQuestions = questions
          .map((question) => `- ${question}`)
          .join("\n");
      }

      await vapi.start(interviewer, {
        variableValues: { questions: formattedQuestions },
      });
    }
  };

  const handleDisconnect = async () => {
    setCallStatus(CallStatus.FINISHED);
    vapi.stop();
  };

  const latestMessage = messages[messages.length - 1]?.content;
  const isCallInactiveOrFinished =
    callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED;

  const isRecording = callStatus === CallStatus.ACTIVE;
  const showWebcam = callStatus === CallStatus.CONNECTING || callStatus === CallStatus.ACTIVE;

  return (
    <>
      <div className="flex w-full flex-col gap-8 lg:flex-row items-center justify-center">
        {/* AI Interviewer Section */}
        <div className="flex-1 w-full max-w-2xl aspect-video relative flex flex-col items-center justify-center gap-2 p-7 blue-gradient-dark rounded-2xl border-2 border-primary-200/50 shadow-xl overflow-hidden">
          <div className="z-10 flex items-center justify-center blue-gradient rounded-full size-[120px] relative">
            <Image
              src="/ai-avatar.png"
              alt="vapi"
              width={65}
              height={54}
              className="object-cover relative z-10"
            />
            {isSpeaking && <span className="absolute inline-flex size-5/6 animate-ping rounded-full bg-primary-200 opacity-75" />}
          </div>
          <h3 className="text-center text-primary-100 mt-5 text-2xl font-semibold relative z-10">AI Interviewer</h3>
        </div>

        {/* User Window Section */}
        <div className="flex-1 w-full max-w-2xl">
          {showWebcam ? (
            <WebcamAnalyzer isRecording={isRecording} onAnalysis={handleVisualAnalysis} />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-primary-200/40 bg-dark-200 text-muted-foreground shadow-xl relative overflow-hidden">
              <Image src="/user-avatar.png" alt="user avatar" width={80} height={80} className="rounded-full object-cover z-10 absolute opacity-5 blur-xl scale-[4] pointer-events-none" />
              <div className="z-10 flex flex-col items-center gap-3">
                <div className="rounded-full p-1 bg-dark-300 border border-dark-700">
                  <Image src="/user-avatar.png" alt="user avatar" width={64} height={64} className="rounded-full object-cover" />
                </div>
                <h3 className="text-center text-lg font-semibold text-light-100">{userName}</h3>
                <p className="text-center text-sm opacity-60">Camera turns on when you start the call</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              key={latestMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100",
              )}
            >
              {latestMessage}
            </p>
          </div>
        </div>
      )}
      <div className="w-full flex justify-center">
        {callStatus !== "ACTIVE" ? (
          <button className="relative btn-call" onClick={handleCall}>
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== "CONNECTING" && "hidden",
              )}
            />
            <span>{isCallInactiveOrFinished ? "Call" : ". . ."}</span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={handleDisconnect}>
            End
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;
