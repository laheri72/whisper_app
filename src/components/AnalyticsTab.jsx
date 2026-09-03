import React, { useState, useEffect } from 'react';
import { 
  Award, TrendingUp, BookOpen, AlertCircle, RefreshCw, Trash2, 
  CheckCircle2, Clock, Layers, Sparkles, BarChart2, ZoomIn, ZoomOut, 
  ExternalLink, Sparkle, Eye, ChevronLeft, ChevronRight, X, ShieldCheck, HelpCircle 
} from 'lucide-react';
import { getJuzPageRange } from '../utils/juzMapping';
import { useApp } from '../context/AppContext';

export const AnalyticsTab = () => {
  const { setActiveTab = () => {}, updateTilawat = () => {} } = useApp();
  
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingWord, setDeletingWord] = useState('');
  const [locatingWord, setLocatingWord] = useState('');
  const [inspectingJuz, setInspectingJuz] = useState(null);

  // Manuscript Retention Modal State
  const [modalTarget, setModalTarget] = useState(null); // { page, label, specificAyah, juzInfo, retentionData }
  const [retentionFilter, setRetentionFilter] = useState('all'); // 'all', 'active_mistake', 'cured', 'mastered'
  const [modalBoxes, setModalBoxes] = useState([]);
  const [loadingModalBoxes, setLoadingModalBoxes] = useState(false);
  const [modalDimensions, setModalDimensions] = useState({ width: 1000, height: 1000 });
  const [modalZoom, setModalZoom] = useState(1);
  const [zoomedPageList, setZoomedPageList] = useState([]);
  const [currentZoomedIndex, setCurrentZoomedIndex] = useState(0);

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
      console.error('Failed to fetch analytics:', err);
      setError('Failed to connect to analytics server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Fetch bounding boxes whenever modal target page changes
  useEffect(() => {
    if (!modalTarget?.page) {
      setModalBoxes([]);
      return;
    }

    let isMounted = true;
    setLoadingModalBoxes(true);
    fetch(`/api/page_boxes/${modalTarget.page}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setModalBoxes(data.boxes || []);
        }
      })
      .catch((err) => {
        console.error('Error fetching page boxes for analytics modal:', err);
        if (isMounted) setModalBoxes([]);
      })
      .finally(() => {
        if (isMounted) setLoadingModalBoxes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [modalTarget?.page]);

  // Handle Keyboard Navigation inside Modal (RTL logic)
  useEffect(() => {
    if (!modalTarget || zoomedPageList.length === 0) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setModalTarget(null);
      } else if (e.key === 'ArrowLeft') {
        if (currentZoomedIndex < zoomedPageList.length - 1) {
          const nextIdx = currentZoomedIndex + 1;
          const nextPg = zoomedPageList[nextIdx];
          setCurrentZoomedIndex(nextIdx);
          setModalTarget((prev) => ({
            ...prev,
            page: nextPg,
            label: `Page ${nextPg}`
          }));
        }
      } else if (e.key === 'ArrowRight') {
        if (currentZoomedIndex > 0) {
          const prevIdx = currentZoomedIndex - 1;
          const prevPg = zoomedPageList[prevIdx];
          setCurrentZoomedIndex(prevIdx);
          setModalTarget((prev) => ({
            ...prev,
            page: prevPg,
            label: `Page ${prevPg}`
          }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalTarget, currentZoomedIndex, zoomedPageList]);

  // Delete mistake from revision queue
  const handleDeleteMistake = async (word) => {
    setDeletingWord(word);
    try {
      const formData = new FormData();
      formData.append('word', word);
      const res = await fetch('/api/delete_mistake', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        fetchAnalytics();
      }
    } catch (err) {
      console.error('Delete mistake error:', err);
    } finally {
      setDeletingWord('');
    }
  };

  // Locate word on Madani Mushaf
  const handleLocateMistakeInMushaf = async (word) => {
    setLocatingWord(word);
    try {
      const res = await fetch(`/api/locate_word?word=${encodeURIComponent(word)}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const match = data.results[0];
        const targetPage = Number(match.page_number || 1);
        setZoomedPageList([targetPage]);
        setCurrentZoomedIndex(0);
        setModalZoom(1);
        setRetentionFilter('all');
        setModalTarget({
          page: targetPage,
          label: `Page ${targetPage} • ${match.surah_name} (${match.ayah_number})`,
          specificAyah: {
            sura: match.surah_number,
            ayah: match.ayah_number,
            surah_name: match.surah_name,
            arabic_text: match.arabic_text,
            targetWord: word
          }
        });
      } else {
        alert(`Could not locate an exact verse occurrence for "${word}".`);
      }
    } catch (err) {
      console.error('Locate word error:', err);
      alert('Failed to locate word in Mushaf.');
    } finally {
      setLocatingWord('');
    }
  };

  // Inspect 30-Juz Multi-Session Retention Map
  const handleInspectJuz = async (juzItem) => {
    setInspectingJuz(juzItem.juz);
    try {
      const res = await fetch(`/api/analytics/retention_map?juz=${juzItem.juz}`);
      const data = await res.json();
      const retentionData = data;

      const range = getJuzPageRange(juzItem.juz);
      const pages = [];
      for (let p = range.startPage; p <= range.endPage; p++) {
        pages.push(p);
      }

      // Prioritize starting on the first active mistake page if errors exist, else opening page
      let initialPage = range.startPage;
      if (retentionData.mistake_pages && retentionData.mistake_pages.length > 0) {
        initialPage = retentionData.mistake_pages[0];
      }

      const initialIdx = pages.indexOf(initialPage) >= 0 ? pages.indexOf(initialPage) : 0;

      setZoomedPageList(pages);
      setCurrentZoomedIndex(initialIdx);
      setModalZoom(1);
      setRetentionFilter(retentionData.stats?.active_mistake_count > 0 ? 'active_mistake' : 'all');
      setModalTarget({
        page: initialPage,
        label: `Juz ${juzItem.juz} • Page ${initialPage}`,
        juzInfo: {
          juz: juzItem.juz,
          score: retentionData.stats?.mastery_percentage ?? juzItem.score,
          attempts: juzItem.attempts,
          status: juzItem.status,
          rangeLabel: `Pages ${range.startPage} – ${range.endPage}`
        },
        retentionData: retentionData
      });
    } catch (err) {
      console.error('Inspect Juz error:', err);
    } finally {
      setInspectingJuz(null);
    }
  };

  // Inspect Past Session Range
  const handleInspectSession = (sess) => {
    const startVal = Number(sess.start_val || 1);
    const endVal = Number(sess.end_val || startVal);
    let startPage = startVal;
    let endPage = endVal;

    if (sess.range_mode === 'juz') {
      const range = getJuzPageRange(startVal);
      startPage = range.startPage;
      endPage = range.endPage;
    }

    const minP = Math.min(startPage, endPage);
    const maxP = Math.max(startPage, endPage);
    const pages = [];
    for (let p = minP; p <= maxP; p++) {
      pages.push(p);
    }

    setZoomedPageList(pages);
    setCurrentZoomedIndex(0);
    setModalZoom(1);
    setRetentionFilter('all');
    setModalTarget({
      page: minP,
      label: `Session Range: Page ${minP} → ${maxP}`
    });
  };

  const handleJumpToTilawat = (pageNum) => {
    updateTilawat({
      pageNumber: Number(pageNum)
    });
    setActiveTab('tilawat');
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
                Cumulative multi-session retention tracking across all 30 Juz
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
              {juz_heatmap.filter((j) => j.attempts > 0).length} / 30
            </span>
          </div>
        </div>
      </div>

      {/* 2. 30-Juz Retention Heatmap */}
      <div className="glass-panel rounded-2xl p-6 border border-gold-500/20 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-gold-400" /> 30-Juz Retention Heatmap
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Click any Juz to inspect active mistakes vs. cured verses on the Madani Mushaf</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Mastered (≥85%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Progressing / Cured (60–84%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Active Errors (&lt;60%)
            </span>
          </div>
        </div>

        {/* 30 Juz Grid Blocks */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10 gap-3">
          {juz_heatmap.map((j) => {
            const isMastered = j.status === 'mastered';
            const isProgressing = j.status === 'in_progress';
            const isRevision = j.status === 'needs_revision';
            const isInspectingThis = inspectingJuz === j.juz;

            let borderStyle = 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700';
            if (isMastered) borderStyle = 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300 shadow-emerald-500/10 hover:border-emerald-400';
            else if (isProgressing) borderStyle = 'border-amber-500/40 bg-amber-950/60 text-amber-300 shadow-amber-500/10 hover:border-amber-400';
            else if (isRevision) borderStyle = 'border-rose-500/40 bg-rose-950/60 text-rose-300 shadow-rose-500/10 hover:border-rose-400';

            return (
              <button
                key={j.juz}
                type="button"
                onClick={() => handleInspectJuz(j)}
                disabled={isInspectingThis}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm relative ${borderStyle}`}
                title={`Click to inspect multi-session retention in Juz ${j.juz}`}
              >
                {isInspectingThis ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400 my-1.5" />
                ) : (
                  <>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Juz {j.juz}</span>
                    <span className="text-sm font-extrabold mt-1">
                      {j.attempts > 0 ? `${j.score}%` : '—'}
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5">
                      {j.attempts} {j.attempts === 1 ? 'attempt' : 'attempts'}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Frequent Mistakes Queue with 'Locate in Mushaf' CTA */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" /> Revision Queue (Frequent Errors)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review flagged words and locate their exact verses on the Madani Mushaf
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
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 group hover:border-amber-500/40 transition-all shadow-sm"
              >
                <div className="space-y-1">
                  <span className="font-arabic text-2xl font-bold text-amber-200 block text-right dir-rtl">
                    {item.word}
                  </span>
                  <span className="text-[10px] text-rose-400 font-semibold uppercase block">
                    Missed {item.error_count} {item.error_count === 1 ? 'time' : 'times'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Locate in Mushaf CTA */}
                  <button
                    onClick={() => handleLocateMistakeInMushaf(item.word)}
                    disabled={locatingWord === item.word}
                    className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all flex items-center gap-1"
                    title="Locate this word on the Madani Mushaf"
                  >
                    {locatingWord === item.word ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <BookOpen className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Delete Mistake Item Button */}
                  <button
                    onClick={() => handleDeleteMistake(item.word)}
                    disabled={deletingWord === item.word}
                    className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 transition-all"
                    title="Remove from revision queue"
                  >
                    {deletingWord === item.word ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Recent Evaluation Logs Table with Range Inspection */}
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
                    <td className="py-3 px-3">
                      <button
                        onClick={() => handleInspectSession(sess)}
                        className="font-mono text-amber-300 font-bold hover:underline flex items-center gap-1"
                        title="Click to view this session range on Mushaf"
                      >
                        <span>{sess.range_mode.toUpperCase()} {sess.start_val} → {sess.end_val}</span>
                        <Eye className="w-3 h-3 text-amber-400/80" />
                      </button>
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
                    <td className="py-3 px-3 text-rose-400 font-bold">{sess.mistake_count}</td>
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

      {/* Multi-Session Retention Lightbox Modal */}
      {modalTarget && (() => {
        const stats = modalTarget.retentionData?.stats || {};
        const allVerses = modalTarget.retentionData?.verses || [];
        const activeMistakeVerses = allVerses.filter((v) => v.status === 'active_mistake');
        const curedVerses = allVerses.filter((v) => v.status === 'cured');
        const masteredVerses = allVerses.filter((v) => v.status === 'mastered');

        const mistakePages = modalTarget.retentionData?.mistake_pages || [];
        const curedPages = modalTarget.retentionData?.cured_pages || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="flex flex-col gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-gold-400 border border-amber-500/30">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-900 dark:text-slate-100">
                          Madani Mushaf • Multi-Session Retention Audit
                        </h3>
                        <span className="text-xs text-amber-600 dark:text-gold-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          Page {modalTarget.page} ({currentZoomedIndex + 1}/{zoomedPageList.length})
                        </span>
                      </div>

                      {/* Specific Ayah Inspection (from Frequent Mistakes card) */}
                      {modalTarget.specificAyah && (
                        <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-rose-400 font-bold">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          <span>{modalTarget.specificAyah.surah_name}, Ayah {modalTarget.specificAyah.ayah} — Flagged Word: "{modalTarget.specificAyah.targetWord}"</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Header Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (currentZoomedIndex > 0) {
                          const prevIdx = currentZoomedIndex - 1;
                          const prevPg = zoomedPageList[prevIdx];
                          setCurrentZoomedIndex(prevIdx);
                          setModalTarget((prev) => ({
                            ...prev,
                            page: prevPg,
                            label: `Page ${prevPg}`
                          }));
                        }
                      }}
                      disabled={currentZoomedIndex <= 0}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      title="Previous Page (RTL Next)"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (currentZoomedIndex < zoomedPageList.length - 1) {
                          const nextIdx = currentZoomedIndex + 1;
                          const nextPg = zoomedPageList[nextIdx];
                          setCurrentZoomedIndex(nextIdx);
                          setModalTarget((prev) => ({
                            ...prev,
                            page: nextPg,
                            label: `Page ${nextPg}`
                          }));
                        }
                      }}
                      disabled={currentZoomedIndex >= zoomedPageList.length - 1}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      title="Next Page (RTL Prev)"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

                    <button
                      onClick={() => setModalZoom((z) => Math.max(0.8, Number((z - 0.2).toFixed(1))))}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono font-bold text-slate-500 w-10 text-center">
                      {Math.round(modalZoom * 100)}%
                    </span>
                    <button
                      onClick={() => setModalZoom((z) => Math.min(2.0, Number((z + 0.2).toFixed(1))))}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        handleJumpToTilawat(modalTarget.page);
                        setModalTarget(null);
                      }}
                      className="hidden sm:flex px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs items-center gap-1.5 shadow transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Tilawat</span>
                    </button>

                    <button
                      onClick={() => setModalTarget(null)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 ml-1 transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Juz Retention Health & Interactive Focus Filter Bar */}
                {modalTarget.retentionData && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                    {/* Retention Counts Breakdown */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-slate-300 font-mono">
                        Juz {modalTarget.juzInfo?.juz}: {stats.mastery_percentage || 0}% Mastered
                      </span>
                      <div className="h-3 w-px bg-slate-700 mx-1" />
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold text-[11px]">
                        🟢 {stats.mastered_count || 0} Mastered
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold text-[11px]">
                        🟡 {stats.cured_count || 0} Cured
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold text-[11px]">
                        🔴 {stats.active_mistake_count || 0} Active Errors
                      </span>
                    </div>

                    {/* Interactive Filter Pills */}
                    <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-[11px]">
                      <button
                        onClick={() => setRetentionFilter('all')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          retentionFilter === 'all' ? 'bg-slate-800 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => {
                          setRetentionFilter('active_mistake');
                          if (mistakePages.length > 0 && !mistakePages.includes(modalTarget.page)) {
                            const pIdx = zoomedPageList.indexOf(mistakePages[0]);
                            if (pIdx >= 0) {
                              setCurrentZoomedIndex(pIdx);
                              setModalTarget((prev) => ({ ...prev, page: mistakePages[0] }));
                            }
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                          retentionFilter === 'active_mistake' ? 'bg-rose-500 text-slate-950 shadow' : 'text-rose-400 hover:bg-rose-950/40'
                        }`}
                      >
                        <span>🔴 Active Errors</span>
                        <span className="text-[10px] font-mono">({stats.active_mistake_count || 0})</span>
                      </button>
                      <button
                        onClick={() => {
                          setRetentionFilter('cured');
                          if (curedPages.length > 0 && !curedPages.includes(modalTarget.page)) {
                            const pIdx = zoomedPageList.indexOf(curedPages[0]);
                            if (pIdx >= 0) {
                              setCurrentZoomedIndex(pIdx);
                              setModalTarget((prev) => ({ ...prev, page: curedPages[0] }));
                            }
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                          retentionFilter === 'cured' ? 'bg-amber-500 text-slate-950 shadow' : 'text-amber-400 hover:bg-amber-950/40'
                        }`}
                      >
                        <span>🟡 Cured</span>
                        <span className="text-[10px] font-mono">({stats.cured_count || 0})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Body with Bounding Boxes */}
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 dark:bg-slate-950 select-none relative min-h-[400px]">
                {loadingModalBoxes ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-amber-500 py-20">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-semibold font-mono uppercase tracking-wider">
                      Loading Manuscript Coordinates...
                    </span>
                  </div>
                ) : (
                  <div
                    className="relative inline-block mx-auto rounded-2xl overflow-hidden bg-amber-50/5 shadow-2xl p-0 m-0 border border-gold-500/30 max-w-full"
                    style={{
                      transform: `scale(${modalZoom})`,
                      transformOrigin: 'center top',
                      transition: 'transform 0.15s ease-out'
                    }}
                  >
                    <img
                      src={`/api/page_image/${modalTarget.page}`}
                      alt={`Manuscript Page ${modalTarget.page}`}
                      onLoad={(e) => {
                        const { naturalWidth, naturalHeight } = e.target;
                        if (naturalWidth && naturalHeight) {
                          setModalDimensions({ width: naturalWidth, height: naturalHeight });
                        }
                      }}
                      className="block max-h-[65vh] w-auto object-contain p-0 m-0 mx-auto select-none pointer-events-none"
                    />

                    {/* Overlaid Highlight Boxes according to Retention State Machine */}
                    {modalBoxes.map((box, idx) => {
                      const isSpecificMatch =
                        modalTarget.specificAyah &&
                        Number(box.sura) === Number(modalTarget.specificAyah.sura) &&
                        Number(box.ayah) === Number(modalTarget.specificAyah.ayah);

                      // Match with verse retention state
                      const verseRetention = allVerses.find(
                        (v) => Number(v.surah_number) === Number(box.sura) && Number(v.ayah_number) === Number(box.ayah)
                      );

                      const vStatus = verseRetention?.status || (isSpecificMatch ? 'active_mistake' : 'unattempted');

                      // Apply interactive filter visibility
                      if (retentionFilter === 'active_mistake' && vStatus !== 'active_mistake' && !isSpecificMatch) return null;
                      if (retentionFilter === 'cured' && vStatus !== 'cured') return null;
                      if (retentionFilter === 'mastered' && vStatus !== 'mastered') return null;

                      const leftPct = (box.min_x / modalDimensions.width) * 100;
                      const topPct = (box.min_y / modalDimensions.height) * 100;
                      const widthPct = ((box.max_x - box.min_x) / modalDimensions.width) * 100;
                      const heightPct = ((box.max_y - box.min_y) / modalDimensions.height) * 100;

                      // 1. Active Mistake (Ruby Rose)
                      if (vStatus === 'active_mistake' || isSpecificMatch) {
                        return (
                          <div
                            key={`retention-box-${box.global_id}-${idx}`}
                            className="absolute z-30 rounded-md bg-rose-500/25 border-2 border-rose-500 shadow-lg ring-2 ring-rose-400/50 animate-pulse transition-all"
                            style={{
                              left: `${leftPct}%`,
                              top: `${topPct}%`,
                              width: `${widthPct}%`,
                              height: `${heightPct}%`
                            }}
                            title={`Active Mistake: Surah ${box.sura}, Ayah ${box.ayah}${verseRetention?.active_mistake_words?.length ? ` (Missed: ${verseRetention.active_mistake_words.join(', ')})` : ''}`}
                          >
                            <div className="absolute -bottom-1 left-0 right-0 h-1 bg-rose-500 rounded-full shadow-md" />
                          </div>
                        );
                      }

                      // 2. Cured / Recovered Verse (Gold / Amber)
                      if (vStatus === 'cured') {
                        return (
                          <div
                            key={`retention-box-${box.global_id}-${idx}`}
                            className="absolute z-20 rounded-md bg-amber-400/20 border-2 border-amber-400 shadow-md ring-1 ring-amber-400/40 transition-all"
                            style={{
                              left: `${leftPct}%`,
                              top: `${topPct}%`,
                              width: `${widthPct}%`,
                              height: `${heightPct}%`
                            }}
                            title={`Cured Verse: Surah ${box.sura}, Ayah ${box.ayah} (Passed in Latest Recitation)`}
                          >
                            <div className="absolute -bottom-1 left-0 right-0 h-1 bg-amber-400 rounded-full shadow-md" />
                          </div>
                        );
                      }

                      // 3. Mastered / Unattempted (Pristine sacred manuscript text - clean)
                      return null;
                    })}
                  </div>
                )}
              </div>

              {/* Modal Bottom Footer with State Legend */}
              <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-amber-50/40 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-mono">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>🔴 Active Mistake (Needs Revision)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span>🟡 Cured in Recent Recitation</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>🟢 Mastered</span>
                  </span>
                </div>

                {modalTarget.specificAyah?.arabic_text && (
                  <div dir="rtl" className="font-arabic text-amber-300 text-sm max-w-md truncate">
                    ﴿{modalTarget.specificAyah.arabic_text}﴾
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AnalyticsTab;
