import React, { useState, useEffect } from 'react';
import { Award, TrendingUp, BookOpen, AlertCircle, RefreshCw, Trash2, CheckCircle2, Clock, Layers, Sparkles, BarChart2 } from 'lucide-react';

export const AnalyticsTab = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingWord, setDeletingWord] = useState('');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError("Failed to connect to analytics server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleDeleteMistake = async (word) => {
    setDeletingWord(word);
    try {
      const formData = new FormData();
      formData.append('word', word);
      const res = await fetch('/api/delete_mistake', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        // Refresh analytics data
        fetchAnalytics();
      }
    } catch (err) {
      console.error("Delete mistake error:", err);
    } finally {
      setDeletingWord('');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-gold-400" />
        <p className="text-sm font-semibold text-slate-400">Loading Performance Records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/30 text-center space-y-2">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <p className="text-sm font-bold text-red-300">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 rounded-xl bg-red-900/60 hover:bg-red-800 text-xs font-bold text-red-200 border border-red-700 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    username,
    total_sessions = 0,
    avg_score = 0,
    mastery_level = 'Developing Reciter',
    recent_sessions = [],
    frequent_mistakes = [],
    juz_heatmap = []
  } = analytics || {};

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Performance Dashboard Card */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-extrabold text-2xl flex items-center justify-center shadow-gold-glow">
              {avg_score}%
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-100">Student ID: {username}</h2>
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {mastery_level}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Cumulative performance across recitation and examination sessions
              </p>
            </div>
          </div>

          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-gold-300 border border-gold-500/30 flex items-center gap-2 transition-all ml-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Quick Metric Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="block text-[10px] text-slate-400 font-semibold uppercase">Sessions Logged</span>
            <span className="text-xl font-bold text-slate-100 mt-0.5 block">{total_sessions}</span>
          </div>

          <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-center">
            <span className="block text-[10px] text-emerald-400 font-semibold uppercase">Average Score</span>
            <span className="text-xl font-bold text-emerald-300 mt-0.5 block">{avg_score}%</span>
          </div>

          <div className="p-4 rounded-xl bg-amber-950/50 border border-amber-500/30 text-center">
            <span className="block text-[10px] text-amber-400 font-semibold uppercase">Flagged Words</span>
            <span className="text-xl font-bold text-amber-300 mt-0.5 block">{frequent_mistakes.length}</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="block text-[10px] text-slate-400 font-semibold uppercase">Juz Coverage</span>
            <span className="text-xl font-bold text-gold-300 mt-0.5 block">
              {juz_heatmap.filter(j => j.attempts > 0).length} / 30
            </span>
          </div>
        </div>
      </div>

      {/* 2. 30-Juz Mastery Heatmap */}
      <div className="glass-panel rounded-2xl p-6 border border-gold-500/20 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-gold-400" /> 30-Juz Retention Heatmap
          </h3>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Mastered (≥85%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Progressing (60–84%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Needs Revision (&lt;60%)
            </span>
          </div>
        </div>

        {/* 30 Juz Grid Blocks */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10 gap-3">
          {juz_heatmap.map((j) => {
            const isMastered = j.status === 'mastered';
            const isProgressing = j.status === 'in_progress';
            const isRevision = j.status === 'needs_revision';

            let borderStyle = 'border-slate-800 bg-slate-950 text-slate-400';
            if (isMastered) borderStyle = 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300 shadow-emerald-500/10';
            else if (isProgressing) borderStyle = 'border-amber-500/40 bg-amber-950/60 text-amber-300 shadow-amber-500/10';
            else if (isRevision) borderStyle = 'border-red-500/40 bg-red-950/60 text-red-300 shadow-red-500/10';

            return (
              <div
                key={j.juz}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${borderStyle}`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400">Juz {j.juz}</span>
                <span className="text-sm font-extrabold mt-1">
                  {j.attempts > 0 ? `${j.score}%` : '—'}
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5">
                  {j.attempts} {j.attempts === 1 ? 'attempt' : 'attempts'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Frequent Mistakes Queue */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" /> Revision Queue (Frequent Errors)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Words flagged during recitation and examination sessions
            </p>
          </div>
        </div>

        {frequent_mistakes.length === 0 ? (
          <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-300">No recurring mistake words flagged!</p>
            <p className="mt-1">Completed sessions will automatically track difficult words here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {frequent_mistakes.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 group hover:border-amber-500/40 transition-all"
              >
                <div className="space-y-1">
                  <span className="font-arabic text-2xl font-bold text-amber-200 block text-right dir-rtl">
                    {item.word}
                  </span>
                  <span className="text-[10px] text-red-400 font-semibold uppercase block">
                    Missed {item.error_count} {item.error_count === 1 ? 'time' : 'times'}
                  </span>
                </div>

                {/* Delete Mistake Item Button */}
                <button
                  onClick={() => handleDeleteMistake(item.word)}
                  disabled={deletingWord === item.word}
                  className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 transition-all"
                  title="Remove from revision queue"
                >
                  {deletingWord === item.word ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Recent Evaluation Logs Table */}
      <div className="glass-panel rounded-2xl p-6 border border-gold-500/20 shadow-xl space-y-4">
        <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
          <Clock className="w-4 h-4 text-gold-400" /> Recent Session Logs
        </h3>

        {recent_sessions.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs font-semibold">
            No evaluation sessions logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Module</th>
                  <th className="py-2.5 px-3">Range</th>
                  <th className="py-2.5 px-3">Score</th>
                  <th className="py-2.5 px-3">Words</th>
                  <th className="py-2.5 px-3">Matches</th>
                  <th className="py-2.5 px-3">Mistakes</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recent_sessions.map((sess, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50 transition-all">
                    <td className="py-3 px-3 capitalize font-bold text-slate-200">
                      {sess.module_type}
                    </td>
                    <td className="py-3 px-3 font-mono text-amber-300">
                      {sess.range_mode.toUpperCase()} {sess.start_val} → {sess.end_val}
                    </td>
                    <td className="py-3 px-3 font-extrabold">
                      <span className={`px-2 py-0.5 rounded ${
                        sess.score >= 80 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                      }`}>
                        {sess.score}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{sess.total_words}</td>
                    <td className="py-3 px-3 text-emerald-400 font-bold">{sess.match_count}</td>
                    <td className="py-3 px-3 text-red-400 font-bold">{sess.mistake_count}</td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">
                      {new Date(sess.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
