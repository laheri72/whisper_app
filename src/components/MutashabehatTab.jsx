import React, { useState, useEffect } from 'react';
import { BookOpen, Sparkles, RefreshCw, Search, HelpCircle, Image, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const MutashabehatTab = () => {
  const {
    quranSimple = null,
    loadingSimple = false,
    fetchQuranSimple = () => {},
    setActiveTab = () => {},
    updateTasmee = () => {},
    updateTilawat = () => {},
    mutashabehatState = {},
    updateMutashabehat = () => {}
  } = useApp() || {};

  const {
    surahNum = 1,
    ayahNum = 1,
    targetVerse = null,
    selectedWords = new Set(),
    matches = [],
    hasSearched = false,
    scopeMode = 'juz',
    selectedJuz = [],
    selectedSurahs = [],
    pageRange = { start: 1, end: 604 }
  } = mutashabehatState || {};

  const safeUpdate = typeof updateMutashabehat === 'function' ? updateMutashabehat : () => {};
  const setSurahNum = (val) => safeUpdate({ surahNum: val });
  const setAyahNum = (val) => safeUpdate({ ayahNum: val });
  const setTargetVerse = (val) => safeUpdate({ targetVerse: val });
  const setSelectedWords = (val) => safeUpdate(prev => ({ selectedWords: typeof val === 'function' ? val(prev?.selectedWords || new Set()) : val }));
  const setMatches = (val) => safeUpdate({ matches: val });
  const setHasSearched = (val) => safeUpdate({ hasSearched: val });
  const setScopeMode = (val) => safeUpdate({ scopeMode: val });
  const setSelectedJuz = (val) => safeUpdate(prev => ({ selectedJuz: typeof val === 'function' ? val(prev?.selectedJuz || []) : val }));
  const setSelectedSurahs = (val) => safeUpdate(prev => ({ selectedSurahs: typeof val === 'function' ? val(prev?.selectedSurahs || []) : val }));
  const setPageRange = (val) => safeUpdate(prev => ({ pageRange: typeof val === 'function' ? val(prev?.pageRange || { start: 1, end: 604 }) : val }));

  const [surahSearchQuery, setSurahSearchQuery] = useState('');

  useEffect(() => {
    if (!quranSimple) {
      fetchQuranSimple();
    }
  }, [quranSimple, fetchQuranSimple]);

  // Helper function to normalize Arabic text
  const normalize = (t) => {
    if (!t) return "";
    return t
      .replace(/[\u064B-\u0652]/g, "") // remove harakat
      .replace(/[\u0671\u0622\u0623\u0625\u0627]/g, "\u0627") // alef normalization
      .replace(/\u0629/g, "\u0647") // taa marbuta -> haa
      .replace(/\u0649/g, "\u064A") // alef maqsura -> yaa
      .trim();
  };

  const handleJuzToggle = (juzVal) => {
    setSelectedJuz(prev => {
      const next = [...prev];
      const idx = next.indexOf(juzVal);
      if (idx >= 0) {
        next.splice(idx, 1);
      } else {
        next.push(juzVal);
      }
      return next;
    });
  };

  const handleSurahToggle = (surahVal) => {
    setSelectedSurahs(prev => {
      const next = [...prev];
      const idx = next.indexOf(surahVal);
      if (idx >= 0) {
        next.splice(idx, 1);
      } else {
        next.push(surahVal);
      }
      return next;
    });
  };

  const loadTarget = () => {
    if (!quranSimple || quranSimple.length === 0) {
      alert("Quran text database is loading, please wait a moment.");
      return;
    }

    const surah = quranSimple.find(s => Number(s.number) === Number(surahNum));
    if (!surah) {
      alert(`Surah ${surahNum} not found.`);
      return;
    }

    const ayah = surah.ayahs.find(a => Number(a.numberInSurah) === Number(ayahNum));
    if (!ayah) {
      alert(`Ayah ${ayahNum} of Surah ${surah.englishName} not found.`);
      return;
    }

    setTargetVerse({ ...ayah, surahName: surah.englishName });
    setSelectedWords(new Set());
    setMatches([]);
    setHasSearched(false);
  };

  const handleWordClick = (word) => {
    const normW = normalize(word);
    setSelectedWords(prev => {
      const next = new Set(prev);
      if (next.has(normW)) {
        next.delete(normW);
      } else {
        next.add(normW);
      }
      return next;
    });
  };

  const findMatches = () => {
    if (!targetVerse || !quranSimple) return;

    const normTarget = normalize(targetVerse.text);
    const targetWordsArr = normTarget.split(/\s+/);
    const tempMatches = [];

    quranSimple.forEach(s => {
      s.ayahs.forEach(a => {
        // Exclude the current source verse
        if (Number(s.number) === Number(surahNum) && Number(a.numberInSurah) === Number(ayahNum)) {
          return;
        }

        // Apply Scope Filter Bounds
        if (scopeMode === 'juz') {
          if (selectedJuz.length > 0 && !selectedJuz.includes(a.juz.toString())) {
            return;
          }
        } else if (scopeMode === 'surah') {
          if (selectedSurahs.length > 0 && !selectedSurahs.includes(s.number.toString())) {
            return;
          }
        } else if (scopeMode === 'page') {
          const startVal = Number(pageRange.start) || 1;
          const endVal = Number(pageRange.end) || 604;
          if (a.page < startVal || a.page > endVal) {
            return;
          }
        }

        const normA = normalize(a.text);
        const aWordsArr = normA.split(/\s+/);

        // Logic 1: Exact Match Check
        const isExact = (normA === normTarget);

        // Logic 2: Priority Word Requirement
        let containsAllPrio = true;
        selectedWords.forEach(pw => {
          if (!aWordsArr.includes(pw)) {
            containsAllPrio = false;
          }
        });

        if (selectedWords.size > 0 && !containsAllPrio) {
          return; // Skip if it doesn't match prioritized pinned words
        }

        // Logic 3: Scoring
        const commonCount = aWordsArr.filter(w => targetWordsArr.includes(w)).length;
        let score = commonCount;
        if (isExact) score += 10000;
        if (containsAllPrio && selectedWords.size > 0) score += 500;

        // Threshold check
        if (score > 3 || isExact) {
          tempMatches.push({
            ...a,
            surahName: s.englishName,
            surahNum: s.number,
            score: score,
            isExact: isExact
          });
        }
      });
    });

    // Sort descending by score
    tempMatches.sort((a, b) => b.score - a.score);
    setMatches(tempMatches);
    setHasSearched(true);
  };

  const handleJumpToTab = (tabId, pageNum) => {
    const page = Number(pageNum);
    if (tabId === 'tasmee') {
      updateTasmee({
        rangeMode: 'page',
        fromPage: page,
        toPage: page,
        activePageIndex: 0
      });
    } else if (tabId === 'tilawat') {
      updateTilawat({
        pageNumber: page
      });
    }
    setActiveTab(tabId);
  };

  // Render text word-by-word with conditional styles for similarities/differences
  const renderHighlightedVerse = (verseText) => {
    if (!targetVerse) return verseText;
    const words = verseText.split(/\s+/);
    const targetWordsArr = normalize(targetVerse.text).split(/\s+/);

    return words.map((w, idx) => {
      const nW = normalize(w);
      let className = "text-slate-900 dark:text-slate-100"; // default common word
      let isPrio = false;
      let isDiff = false;

      if (selectedWords.has(nW)) {
        className = "text-amber-600 dark:text-amber-400 font-extrabold underline decoration-amber-500 decoration-2 underline-offset-4";
        isPrio = true;
      } else if (!targetWordsArr.includes(nW)) {
        className = "text-red-600 dark:text-red-400 font-extrabold bg-red-100 dark:bg-red-950/30 px-1 rounded border border-red-200 dark:border-red-500/30";
        isDiff = true;
      }

      return (
        <span 
          key={idx} 
          className={`${className} inline-block ml-1.5`} 
          title={isPrio ? "Prioritized Match" : isDiff ? "Difference from Target" : "Common Word"}
        >
          {w}
        </span>
      );
    });
  };

  // Filter 114 Surahs list based on query
  const filteredSurahsList = quranSimple 
    ? quranSimple.filter(s => 
        s.englishName.toLowerCase().includes(surahSearchQuery.toLowerCase()) || 
        s.number.toString().includes(surahSearchQuery)
      )
    : [];

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-arabic tracking-wide" dir="rtl">مُتَشَابِهَاتُ القُرْآنِ الكَرِيمِ</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Find and analyze Quranic verbal similarities & differences (Mutashabehat) offline.</p>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-sm">
        {loadingSimple ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-sm font-semibold tracking-wider uppercase font-mono text-amber-600 dark:text-gold-400">Caching Quranic Text Database...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Input Form */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Surah Number</label>
                <input 
                  type="number" 
                  min="1" 
                  max="114" 
                  value={surahNum}
                  onChange={(e) => setSurahNum(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 text-sm font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ayah Number</label>
                <input 
                  type="number" 
                  min="1" 
                  value={ayahNum}
                  onChange={(e) => setAyahNum(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 text-sm font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 opacity-0 select-none">Load</label>
                <button 
                  onClick={loadTarget}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow transition-all border border-amber-600/20"
                >
                  <BookOpen className="w-4 h-4" /> Load Source Verse
                </button>
              </div>
            </div>

            {/* Target Verse Interactive Area */}
            {targetVerse && (
              <div className="p-6 rounded-2xl bg-amber-50/50 dark:bg-amber-950/10 border border-dashed border-amber-400/40 dark:border-amber-500/30 space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-500/10 pb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-500">Source Target Verse (Tap words to prioritize):</span>
                  <span className="text-[11px] font-bold font-mono text-slate-500 dark:text-slate-400">Surah {targetVerse.surahName || surahNum} ({surahNum}):{targetVerse.numberInSurah}</span>
                </div>
                
                {/* Clickable Words */}
                <div className="text-right py-4 leading-[2.4]" dir="rtl">
                  {targetVerse.text.split(/\s+/).map((w, idx) => {
                    const normW = normalize(w);
                    const isSelected = selectedWords.has(normW);
                    return (
                      <span 
                        key={idx}
                        onClick={() => handleWordClick(w)}
                        className={`inline-block mx-1 px-2.5 py-1 rounded-xl text-2xl font-arabic cursor-pointer transition-all hover:scale-105 ${
                          isSelected 
                            ? 'bg-amber-500 text-slate-950 font-extrabold border border-amber-400/30 shadow-sm' 
                            : 'bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {w}
                      </span>
                    );
                  })}
                </div>

                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                  Prioritized words (highlighted in gold) restrict results to only those containing them.
                </div>
              </div>
            )}

            {/* Scope Controls */}
            <div className="border-t border-slate-200 dark:border-slate-800/80 pt-6 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Search Scope Configuration</h3>
                
                <div className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-1.5 max-w-sm">
                  {['juz', 'surah', 'page'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setScopeMode(mode)}
                      className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                        scopeMode === mode 
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow border border-slate-200 dark:border-slate-700/60'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {mode === 'juz' && 'By Juz'}
                      {mode === 'surah' && 'By Surah'}
                      {mode === 'page' && 'By Page Range'}
                    </button>
                  ))}
                </div>
              </div>

              {/* By Juz Tab View */}
              {scopeMode === 'juz' && (
                <div className="space-y-2.5 animate-fadeIn">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Filter by Juz (Pick multiple to restrict search)</span>
                  <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2 w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    {Array.from({ length: 30 }, (_, index) => {
                      const j = index + 1;
                      const isChecked = selectedJuz.includes(j.toString());
                      return (
                        <label 
                          key={j} 
                          className={`flex items-center justify-center p-1 text-sm rounded-lg border font-mono font-bold cursor-pointer transition-all ${
                            isChecked 
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-300' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            value={j} 
                            checked={isChecked}
                            onChange={() => handleJuzToggle(j.toString())}
                            className="hidden"
                          />
                          J{j}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* By Surah Tab View */}
              {scopeMode === 'surah' && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Filter by Surah (Select target Surahs)</span>
                    <input
                      type="text"
                      placeholder="Search Surah name or index..."
                      value={surahSearchQuery}
                      onChange={(e) => setSurahSearchQuery(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 w-full sm:max-w-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[140px] overflow-y-auto bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    {filteredSurahsList.length === 0 ? (
                      <div className="text-center text-xs text-slate-500 dark:text-slate-400 py-6 col-span-full">No Surahs found matching query.</div>
                    ) : (
                      filteredSurahsList.map((s) => {
                        const isChecked = selectedSurahs.includes(s.number.toString());
                        return (
                          <label 
                            key={s.number} 
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                              isChecked 
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              value={s.number} 
                              checked={isChecked}
                              onChange={() => handleSurahToggle(s.number.toString())}
                              className="accent-amber-500 shrink-0"
                            />
                            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">#{s.number}</span>
                            <span className="truncate">{s.englishName}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* By Page Tab View */}
              {scopeMode === 'page' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md animate-fadeIn">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Start Page (1-604)</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="604" 
                      value={pageRange.start}
                      onChange={(e) => setPageRange(prev => ({ ...prev, start: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">End Page (1-604)</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="604" 
                      value={pageRange.end}
                      onChange={(e) => setPageRange(prev => ({ ...prev, end: Math.min(604, parseInt(e.target.value, 10) || 604) }))}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Execute Search Trigger */}
            <div className="border-t border-slate-200 dark:border-slate-800/80 pt-5 flex justify-end">
              <button 
                onClick={findMatches}
                disabled={!targetVerse}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-40"
              >
                <Search className="w-4 h-4" /> <span>Find Similarity Matches</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Area */}
      {hasSearched && (
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-slate-500 dark:text-slate-350 font-mono tracking-wider uppercase">
            Found {matches.length} verbal similarity match{matches.length !== 1 ? 'es' : ''}:
          </h3>
          
          {matches.length === 0 ? (
            <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs font-semibold animate-fadeIn">
              No matching verses with similarities found. Adjust word selectors or scope constraints.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 animate-fadeIn">
              {matches.map((m, index) => (
                <div 
                  key={index} 
                  className={`bg-white dark:bg-slate-950 border rounded-2xl p-5 shadow-sm flex flex-col space-y-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 ${
                    m.isExact 
                      ? 'border-amber-500/40 bg-amber-500/[0.02] dark:bg-amber-950/[0.04]' 
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Result Header containing Metadata & Navigation Jump Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-b border-slate-150 dark:border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 font-bold uppercase font-mono tracking-wider">
                        {m.isExact ? (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">★ EXACT MATCH</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">SIMILARITY MATCH</span>
                        )}
                      </div>
                      <span className="text-slate-500 dark:text-slate-400 font-mono">
                        Surah {m.surahName} ({m.surahNum}), Ayah {m.numberInSurah} | Juz {m.juz} | Page {m.page}
                      </span>
                    </div>
                    
                    {/* Action buttons to jump to Tasmee / Tilawat */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleJumpToTab('tasmee', m.page)}
                        className="px-2.5 py-1 rounded-lg border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1"
                        title="Jump directly to this page in Tasmee Tab"
                      >
                        <span>Open in Tasmee</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleJumpToTab('tilawat', m.page)}
                        className="px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1"
                        title="Jump directly to this page in Tilawat Tab"
                      >
                        <span>Open in Tilawat</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Streaming Madani Manuscript Image */}
                  <div className="w-full flex flex-col bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900 overflow-hidden p-1.5 select-none">
                    <div className="flex items-center gap-1.5 px-2 py-1 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-900/60 mb-1">
                      <Image className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider font-mono">Madani Quran Manuscript — Page {m.page}</span>
                    </div>
                    <img 
                      src={`/api/page_image/${m.page}`}
                      alt={`Manuscript Page ${m.page}`}
                      className="w-full h-auto object-contain max-h-[300px] hover:scale-[1.01] transition-transform duration-200"
                      loading="lazy"
                    />
                  </div>
                  
                  {/* Highlighted text block below acting as the color key */}
                  <div className="text-right leading-[2.4] font-arabic text-2xl py-3 border-t border-slate-200 dark:border-slate-850" dir="rtl">
                    {renderHighlightedVerse(m.text)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MutashabehatTab;
