"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    INTERVIEW_ROLES,
    EXPERIENCE_LEVELS,
    INTERVIEW_TYPES,
    mappings,
} from "@/constants";
import { createInterview } from "@/lib/actions/interview.action";
import { toast } from "sonner";
import { Loader2, Mic, Volume2, Plus, X } from "lucide-react";

interface InterviewSetupProps {
    userId: string;
}

const steps = [
    {
        id: "role",
        question: "What role are you interviewing for?",
        options: INTERVIEW_ROLES,
        multiSelect: false,
    },
    {
        id: "level",
        question: "What is your experience level?",
        options: EXPERIENCE_LEVELS,
        multiSelect: false,
    },
    {
        id: "type",
        question: "What type of interview would you like?",
        options: INTERVIEW_TYPES,
        multiSelect: false,
    },
    {
        id: "techStack",
        question: "Select the technologies you want to focus on.",
        options: Object.keys(mappings),
        multiSelect: true,
    },
];

const InterviewSetup = ({ userId }: InterviewSetupProps) => {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState({
        role: "",
        level: "",
        type: "",
        techStack: [] as string[],
        questionCount: 0,
    });
    const [customRole, setCustomRole] = useState("");
    const [customTech, setCustomTech] = useState("");
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [loading, setLoading] = useState(false);

    const predefinedTechOptions = Object.keys(mappings);
    const customTechsInStack = formData.techStack.filter((t) => !predefinedTechOptions.includes(t));

    const steps = [
        {
            id: "role",
            question: "What role are you interviewing for?",
            options: [...INTERVIEW_ROLES, "Other"],
            multiSelect: false,
        },
        {
            id: "level",
            question: "What is your experience level?",
            options: EXPERIENCE_LEVELS,
            multiSelect: false,
        },
        {
            id: "type",
            question: "What type of interview would you like?",
            options: INTERVIEW_TYPES,
            multiSelect: false,
        },
        {
            id: "questionCount",
            question: "How many questions would you like?",
            options: ["5", "10", "15", "20"],
            multiSelect: false,
        },
        {
            id: "techStack",
            question: "Select the technologies you want to focus on.",
            options: predefinedTechOptions,
            multiSelect: true,
        },
    ];

    const currentQuestion = steps[currentStep];

    useEffect(() => {
        speak(currentQuestion.question);
    }, [currentStep]);

    const speak = (text: string) => {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
        }
    };

    const handleSelect = (option: string) => {
        if (currentQuestion.multiSelect) {
            setFormData((prev) => {
                const newStack = prev.techStack.includes(option)
                    ? prev.techStack.filter((item) => item !== option)
                    : [...prev.techStack, option];
                return { ...prev, techStack: newStack };
            });
        } else {
            if (currentQuestion.id === "questionCount") {
                setFormData((prev) => ({ ...prev, questionCount: parseInt(option) }));
            } else {
                setFormData((prev) => ({ ...prev, [currentQuestion.id]: option }));
            }

            // Auto-advance for single select (unless "Other" role is selected)
            if (option !== "Other") {
                setTimeout(() => {
                    if (currentStep < steps.length - 1) {
                        setCurrentStep((prev) => prev + 1);
                    }
                }, 500);
            }
        }
    };

    const addCustomTech = () => {
        const value = customTech.trim();
        if (!value) return;
        if (formData.techStack.includes(value)) {
            toast.error("Already added");
            return;
        }
        setFormData((prev) => ({ ...prev, techStack: [...prev.techStack, value] }));
        setCustomTech("");
    };

    const removeFromTechStack = (tech: string) => {
        setFormData((prev) => ({
            ...prev,
            techStack: prev.techStack.filter((t) => t !== tech),
        }));
    };

    const handleNext = () => {
        if (currentQuestion.id === "role" && formData.role === "Other" && !customRole) {
            toast.error("Please enter a custom role");
            return;
        }

        if (currentStep < steps.length - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        if (!userId) {
            toast.error("Please sign in to create an interview.");
            return;
        }

        setLoading(true);
        try {
            const finalRole = formData.role === "Other" ? customRole.trim() : formData.role;
            if (!finalRole) {
                toast.error("Please enter or select a role.");
                setLoading(false);
                return;
            }

            const questionCount = Math.min(20, Math.max(1, formData.questionCount || 5));
            const payload = {
                userId,
                role: finalRole,
                level: formData.level,
                type: formData.type,
                techStack: formData.techStack,
                questionCount,
            };

            console.log("[InterviewSetup] Submitting (option-based, no Vapi):", payload);

            const result = await createInterview(payload);

            console.log("[InterviewSetup] Server response:", result?.success ? "success" : "failed", result);

            if (result.success && result.interviewId) {
                toast.success("Interview generated successfully!");
                router.push(`/interview/${result.interviewId}`);
            } else {
                const errorMsg = result.error || "Failed to generate interview. Please try again.";
                toast.error(errorMsg);
                console.error("[InterviewSetup] Interview generation failed:", errorMsg, result);
            }
        } catch (error) {
            console.error("Error submitting form:", error);
            toast.error("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const isSelected = (option: string) => {
        if (currentQuestion.multiSelect) {
            return formData.techStack.includes(option);
        }
        if (currentQuestion.id === "questionCount") {
            return formData.questionCount.toString() === option;
        }
        // @ts-ignore
        return formData[currentQuestion.id] === option;
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 max-w-3xl mx-auto p-6">
            <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-primary">
                    {isSpeaking ? (
                        <Volume2 className="animate-pulse size-8" />
                    ) : (
                        <div className="size-8" />
                    )}
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {currentQuestion.question}
                </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                {currentQuestion.options.map((option) => (
                    <Button
                        key={option}
                        variant={isSelected(option) ? "default" : "outline"}
                        className={`h-auto min-h-[60px] whitespace-normal py-4 text-lg justify-start px-6 transition-all ${isSelected(option)
                            ? "ring-2 ring-offset-2 ring-primary"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                        onClick={() => handleSelect(option)}
                    >
                        {option}
                    </Button>
                ))}
            </div>

            {currentQuestion.id === "role" && formData.role === "Other" && (
                <div className="w-full max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
                    <input
                        type="text"
                        value={customRole}
                        onChange={(e) => setCustomRole(e.target.value)}
                        placeholder="Enter your specific role (e.g., Cybersecurity Analyst)"
                        className="w-full p-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                </div>
            )}

            {currentQuestion.id === "techStack" && (
                <div className="w-full space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                    <p className="text-sm text-muted-foreground">Not listed? Add your own:</p>
                    <div className="flex gap-2 flex-wrap">
                        <input
                            type="text"
                            value={customTech}
                            onChange={(e) => setCustomTech(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTech())}
                            placeholder="e.g. Rust, Swift, Kotlin"
                            className="flex-1 min-w-[140px] p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                        <Button type="button" variant="outline" onClick={addCustomTech} disabled={!customTech.trim()}>
                            <Plus className="mr-1 size-4" />
                            Add
                        </Button>
                    </div>
                    {customTechsInStack.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {customTechsInStack.map((tech) => (
                                <span
                                    key={tech}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm"
                                >
                                    {tech}
                                    <button
                                        type="button"
                                        onClick={() => removeFromTechStack(tech)}
                                        className="hover:bg-primary/20 rounded-full p-0.5"
                                        aria-label={`Remove ${tech}`}
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="flex justify-end w-full mt-8">
                {(currentQuestion.multiSelect ||
                    currentStep === steps.length - 1 ||
                    (currentQuestion.id === "role" && formData.role === "Other")) && (
                        <Button
                            size="lg"
                            onClick={handleNext}
                            disabled={loading || (currentQuestion.multiSelect && formData.techStack.length === 0)}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                "Next Step"
                            )}
                        </Button>
                    )}
            </div>
        </div>
    );
};

export default InterviewSetup;
