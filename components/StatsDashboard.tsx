"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import dayjs from "dayjs";

interface CategoryScore {
  name: string;
  score: number;
  comment: string;
}

interface QuestionFeedbackItem {
  question: string;
  score: number;
  comment: string;
}

interface Feedback {
  id: string;
  interviewId: string;
  totalScore: number;
  categoryScores: CategoryScore[];
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  BodyLanguageAndConfidence?: number;
  questionFeedback?: QuestionFeedbackItem[];
  durationSeconds?: number;
  createdAt: string;
}

interface StatsDashboardProps {
  feedbacks: Feedback[];
}

export default function StatsDashboard({ feedbacks }: StatsDashboardProps) {
  const stats = useMemo(() => {
    if (feedbacks.length === 0) return null;

    // Line Chart Data: Score over time
    const lineData = feedbacks.map((f, index) => ({
      name: `Int ${index + 1}`,
      date: dayjs(f.createdAt).format("MMM D"),
      score: f.totalScore,
    }));

    // Radar Chart Data: Average score per category
    const categoryTotals: Record<string, { total: number; count: number }> = {};
    let totalScoreSum = 0;

    feedbacks.forEach((f) => {
      totalScoreSum += f.totalScore;
      f.categoryScores?.forEach((c) => {
        if (!categoryTotals[c.name]) {
          categoryTotals[c.name] = { total: 0, count: 0 };
        }
        categoryTotals[c.name].total += c.score;
        categoryTotals[c.name].count += 1;
      });
    });

    const radarData = Object.entries(categoryTotals).map(([key, val]) => ({
      subject: key.replace(" Skills", "").replace(" Knowledge", "").replace(" and Clarity", ""),
      score: Math.round(val.total / val.count),
      fullMark: 100,
    }));

    const averageTotal = Math.round(totalScoreSum / feedbacks.length);

    // Strongest skill determination
    let strongestSkill = "N/A";
    let maxAvg = 0;
    let weakestSkill = "N/A";
    let minAvg = 101;

    radarData.forEach((d) => {
      if (d.score > maxAvg) {
        maxAvg = d.score;
        strongestSkill = d.subject;
      }
      if (d.score < minAvg) {
        minAvg = d.score;
        weakestSkill = d.subject;
      }
    });

    return {
      lineData,
      radarData,
      averageTotal,
      strongestSkill,
      weakestSkill,
      totalInterviews: feedbacks.length,
    };
  }, [feedbacks]);

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center p-12 card border-dark-700 border">
        <h3 className="text-xl font-semibold text-light-100">No Data Available</h3>
        <p className="text-light-400 mt-2 text-center">
          Take your first interview to see your performance dashboard!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-6 border border-dark-700 flex flex-col gap-1">
          <p className="text-light-400 text-sm font-medium">Total Interviews</p>
          <p className="text-3xl font-bold text-light-100">{stats.totalInterviews}</p>
        </div>
        <div className="card p-6 border border-dark-700 flex flex-col gap-1">
          <p className="text-light-400 text-sm font-medium">Average Score</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-primary-200">{stats.averageTotal}</p>
            <p className="text-light-400 text-sm mb-1">/ 100</p>
          </div>
        </div>
        <div className="card p-6 border border-dark-700 flex flex-col gap-1">
          <p className="text-light-400 text-sm font-medium">Strongest Skill</p>
          <p className="text-xl font-bold text-success-100 mt-1 capitalize">{stats.strongestSkill}</p>
        </div>
        <div className="card p-6 border border-dark-700 flex flex-col gap-1">
          <p className="text-light-400 text-sm font-medium">Focus Area</p>
          <p className="text-xl font-bold text-destructive-100 mt-1 capitalize">{stats.weakestSkill}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
        {/* Line Chart */}
        <div className="card p-6 border border-dark-700 min-h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold text-light-100 mb-6">Score Progression</h3>
          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.lineData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#242633" />
                <XAxis
                  dataKey="date"
                  stroke="#6870a6"
                  fontSize={12}
                  tickMargin={10}
                />
                <YAxis
                  stroke="#6870a6"
                  fontSize={12}
                  domain={[0, 100]}
                />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#1A1C20', border: '1px solid #242633', borderRadius: '8px' }}
                  itemStyle={{ color: '#cac5fe' }}
                  labelStyle={{ color: '#6870a6', marginBottom: '4px' }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#dddfff"
                  strokeWidth={3}
                  activeDot={{ r: 8, fill: '#cac5fe' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="card p-6 border border-dark-700 min-h-[400px] flex flex-col items-center justify-center relative">
          <h3 className="text-lg font-semibold text-light-100 mb-2 absolute top-6 left-6">Skill Analysis</h3>
          <div className="w-full h-[320px] mt-8">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={stats.radarData}>
                <PolarGrid stroke="#4f557d" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#cac5fe', fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: '#6870a6', fontSize: 10 }}
                  stroke="#4f557d"
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#cac5fe"
                  fill="#cac5fe"
                  fillOpacity={0.4}
                />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#1A1C20', border: '1px solid #242633', borderRadius: '8px' }}
                  itemStyle={{ color: '#cac5fe' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
