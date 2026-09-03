import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, Sparkles, RefreshCw, Search, HelpCircle, Image, ArrowRight, 
  Eye, X, ZoomIn, ZoomOut, Check, ChevronDown, Filter, Type, Layers, 
  ExternalLink, Hash, CornerDownLeft, Mic, Sparkle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FULL_SURAH_LIST } from '../utils/juzMapping';

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
    searchMode = 'verse', // 'verse' | 'keyword'
    keywordQuery = '',
    keywordMatchType = 'phrase', // 'phrase' | 'all' | 'any'
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
  
  const setSearchMode = (val) => safeUpdate({ searchMode: val });
  const setKeywordQuery = (val) => safeUpdate({ keywordQuery: val });
  const setKeywordMatchType = (val) => safeUpdate({ keywordMatchType: val });
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

  // Local UI State
  const [surahDropdownOpen, setSurahDropdownOpen] = useState(false);
  const [surahSearchText, setSurahSearchText] = useState('');
  const [scopeSurahSearchText, setScopeSurahSearchText] = useState('');
  
  // Manuscript Highlight Modal State
  const [modalTarget, setModalTarget] = useState(null); // { page, surahNum, ayahNum, surahName, text }
  const [modalBoxes, setModalBoxes] = useState([]);
  const [loadingModalBoxes, setLoadingModalBoxes] = useState(false);
  const [modalDimensions, setModalDimensions] = useState({ width: 1000, height: 1000 });
  const [modalZoom, setModalZoom] = useState(1);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!quranSimple) {
      fetchQuranSimple();
    }
  }, [quranSimple, fetchQuranSimple]);

  // Fetch page bounding boxes when modal target opens
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
        console.error('Error fetching page boxes for modal:', err);
        if (isMounted) setModalBoxes([]);
      })
      .finally(() => {
        if (isMounted) setLoadingModalBoxes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [modalTarget?.page]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setSurahDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Normalization for Arabic text search
  const normalize = (t) => {
    if (!t) return '';
    return t
      .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED]/g, '') // remove harakat & Quranic marks
      .replace(/[\u0671\u0622\u0623\u0625\u0627\u0672\u0673\u0675]/g, '\u0627') // alef variants
      .replace(/[\u0629\u06C3]/g, '\u0647') // taa marbuta -> haa
      .replace(/[\u0649\u06CC\u06D2]/g, '\u064A') // alef maqsura / farsi yeh -> yaa
      .replace(/[\u0640]/g, '') // tatweel
      .trim();
  };

  const toArabicDigits = (num) => {
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    return String(num).replace(/[0-9]/g, (w) => arabicDigits[+w]);
  };

  const currentSurahObj = useMemo(() => {
    const sId = Number(surahNum) || 1;
    return FULL_SURAH_LIST.find((s) => s.id === sId) || FULL_SURAH_LIST[0];
  }, [surahNum]);

  const filteredDropdownSurahs = useMemo(() => {
    if (!surahSearchText.trim()) return FULL_SURAH_LIST;
    const query = surahSearchText.toLowerCase().trim();
    return FULL_SURAH_LIST.filter(
      (s) =>
        s.id.toString().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        s.arabic.includes(query)
    );
  }, [surahSearchText]);

  const filteredScopeSurahs = useMemo(() => {
    if (!scopeSurahSearchText.trim()) return FULL_SURAH_LIST;
    const query = scopeSurahSearchText.toLowerCase().trim();
    return FULL_SURAH_LIST.filter(
      (s) =>
        s.id.toString().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        s.arabic.includes(query)
    );
  }, [scopeSurahSearchText]);

  const handleSelectSurah = (surah) => {
    setSurahNum(surah.id);
    setSurahDropdownOpen(false);
    setSurahSearchText('');
    setAyahNum((prev) => Math.min(Math.max(1, Number(prev) || 1), surah.totalAyahs));
  };

  const handleJuzToggle = (juzVal) => {
    setSelectedJuz((prev) => {
      const next = [...prev];
      const idx = next.indexOf(juzVal);
      if (idx >= 0) next.splice(idx, 1);
      else next.push(juzVal);
      return next;
    });
  };

  const handleSurahToggle = (surahVal) => {
    setSelectedSurahs((prev) => {
      const next = [...prev];
      const idx = next.indexOf(surahVal);
      if (idx >= 0) next.splice(idx, 1);
      else next.push(surahVal);
      return next;
    });
  };

  const loadTarget = () => {
    if (!quranSimple || quranSimple.length === 0) {
      alert('Quran text database is loading, please wait a moment.');
      return;
    }

    const surah = quranSimple.find((s) => Number(s.number) === Number(surahNum));
    if (!surah) {
      alert(`Surah ${surahNum} not found.`);
      return;
    }

    const ayah = surah.ayahs.find((a) => Number(a.numberInSurah) === Number(ayahNum));
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
    setSelectedWords((prev) => {
      const next = new Set(prev);
      if (next.has(normW)) {
        next.delete(normW);
      } else {
        next.add(normW);
      }
      return next;
    });
  };

  // Main search function handling both Verse Mode and Direct Keyword Mode
  const executeSearch = () => {
    if (!quranSimple || quranSimple.length === 0) return;

    const tempMatches = [];

    if (searchMode === 'verse') {
      if (!targetVerse) return;
      const normTarget = normalize(targetVerse.text);
      const targetWordsArr = normTarget.split(/\s+/).filter(Boolean);

      quranSimple.forEach((s) => {
        s.ayahs.forEach((a) => {
          if (Number(s.number) === Number(surahNum) && Number(a.numberInSurah) === Number(ayahNum)) {
            return; // Exclude self
          }

          // Scope Filters
          if (scopeMode === 'juz') {
            if (selectedJuz.length > 0 && !selectedJuz.includes(a.juz.toString())) return;
          } else if (scopeMode === 'surah') {
            if (selectedSurahs.length > 0 && !selectedSurahs.includes(s.number.toString())) return;
          } else if (scopeMode === 'page') {
            const sv = Number(pageRange.start) || 1;
            const ev = Number(pageRange.end) || 604;
            if (a.page < sv || a.page > ev) return;
          }

          const normA = normalize(a.text);
          const aWordsArr = normA.split(/\s+/).filter(Boolean);

          const isExact = normA === normTarget;

          let containsAllPrio = true;
          selectedWords.forEach((pw) => {
            if (!aWordsArr.includes(pw)) containsAllPrio = false;
          });

          if (selectedWords.size > 0 && !containsAllPrio) return;

          const commonCount = aWordsArr.filter((w) => targetWordsArr.includes(w)).length;
          let score = commonCount;
          if (isExact) score += 10000;
          if (containsAllPrio && selectedWords.size > 0) score += 500;

          if (score >= 3 || isExact) {
            tempMatches.push({
              ...a,
              surahName: s.englishName,
              surahNum: s.number,
              score,
              isExact,
              matchType: isExact ? 'exact' : selectedWords.size > 0 ? 'priority' : 'similarity'
            });
          }
        });
      });
    } else {
      // Direct Word / Multi-Word Phrase Search
      const normQuery = normalize(keywordQuery);
      if (!normQuery) {
        alert('Please enter an Arabic word or phrase to search.');
        return;
      }
      const qWords = normQuery.split(/\s+/).filter(Boolean);

      quranSimple.forEach((s) => {
        s.ayahs.forEach((a) => {
          // Scope Filters
          if (scopeMode === 'juz') {
            if (selectedJuz.length > 0 && !selectedJuz.includes(a.juz.toString())) return;
          } else if (scopeMode === 'surah') {
            if (selectedSurahs.length > 0 && !selectedSurahs.includes(s.number.toString())) return;
          } else if (scopeMode === 'page') {
            const sv = Number(pageRange.start) || 1;
            const ev = Number(pageRange.end) || 604;
            if (a.page < sv || a.page > ev) return;
          }

          const normA = normalize(a.text);
          const aWordsArr = normA.split(/\s+/).filter(Boolean);

          const isPhraseMatch = normA.includes(normQuery);
          const matchedWordsCount = qWords.filter((qw) => aWordsArr.includes(qw)).length;
          const hasAllWords = matchedWordsCount === qWords.length;
          const hasAnyWord = matchedWordsCount > 0;

          let score = 0;
          let isQualified = false;

          if (keywordMatchType === 'phrase') {
            if (isPhraseMatch) {
              score = 10000 + matchedWordsCount;
              isQualified = true;
            }
          } else if (keywordMatchType === 'all') {
            if (hasAllWords) {
              score = 500 + matchedWordsCount;
              if (isPhraseMatch) score += 1000;
              isQualified = true;
            }
          } else {
            // 'any'
            if (hasAnyWord) {
              score = matchedWordsCount * 10;
              if (hasAllWords) score += 500;
              if (isPhraseMatch) score += 1000;
              isQualified = true;
            }
          }

          if (isQualified) {
            tempMatches.push({
              ...a,
              surahName: s.englishName,
              surahNum: s.number,
              score,
              isExact: isPhraseMatch,
              matchType: isPhraseMatch ? 'exact' : hasAllWords ? 'priority' : 'similarity'
            });
          }
        });
      });
    }

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

  // Highlighting verse words
  const renderHighlightedVerse = (verseText) => {
    const words = verseText.split(/\s+/).filter(Boolean);

    if (searchMode === 'verse' && targetVerse) {
      const targetWordsArr = normalize(targetVerse.text).split(/\s+/).filter(Boolean);
      return words.map((w, idx) => {
        const nW = normalize(w);
        let className = 'text-slate-800 dark:text-slate-200';
        let isPrio = false;
        let isDiff = false;

        if (selectedWords.has(nW)) {
          className = 'text-amber-600 dark:text-gold-400 font-extrabold bg-amber-500/10 px-1.5 py-0.5 rounded-lg border border-amber-500/30 underline decoration-amber-500 decoration-2 underline-offset-4';
          isPrio = true;
        } else if (!targetWordsArr.includes(nW)) {
          className = 'text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-1 rounded border border-rose-500/20';
          isDiff = true;
        }

        return (
          <span
            key={idx}
            className={`${className} inline-block mx-1 transition-all`}
            title={isPrio ? 'Pinned Priority Match' : isDiff ? 'Difference from Source' : 'Common Word'}
          >
            {w}
          </span>
        );
      });
    }

    // Keyword Search Highlighting
    const normQuery = normalize(keywordQuery);
    const qWords = normQuery.split(/\s+/).filter(Boolean);

    return words.map((w, idx) => {
      const nW = normalize(w);
      const isMatch = qWords.some((qw) => nW.includes(qw) || qw.includes(nW));

      return (
        <span
          key={idx}
          className={`inline-block mx-1 transition-all ${
            isMatch
              ? 'text-amber-600 dark:text-gold-400 font-extrabold bg-amber-500/15 px-1.5 py-0.5 rounded-lg border border-amber-500/40 shadow-sm'
              : 'text-slate-800 dark:text-slate-200'
          }`}
          title={isMatch ? 'Keyword Match' : ''}
        >
          {w}
        </span>
      );
    });
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 pb-16">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-500 dark:text-gold-400 flex-shrink-0 border border-amber-500/30 shadow-inner">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold font-arabic tracking-wide" dir="rtl">
                مُتَشَابِهَاتُ القُرْآنِ الكَرِيمِ
              </h2>
              <span className="text-[10px] font-bold font-mono uppercase bg-amber-500/10 text-amber-600 dark:text-gold-400 px-2.5 py-1 rounded-full border border-amber-500/30">
                Verbal Similarity Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Cross-reference verse similarities and multi-word mutashabehat occurrences offline.
            </p>
          </div>
        </div>

        {/* Search Mode Toggle (Verse-Based vs Direct Word/Phrase Search) */}
        <div className="bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-1 w-full md:w-auto shadow-inner">
          <button
            onClick={() => setSearchMode('verse')}
            className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              searchMode === 'verse'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Verse-Based Search</span>
          </button>
          <button
            onClick={() => setSearchMode('keyword')}
            className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              searchMode === 'keyword'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Word & Phrase Search</span>
          </button>
        </div>
      </div>

      {/* Main Search Panel */}
      <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-sm">
        {loadingSimple ? (
          <div className="flex flex-col items-center justify-center py-14 space-y-4">
            <RefreshCw className="w-9 h-9 animate-spin text-amber-500" />
            <span className="text-sm font-semibold tracking-wider uppercase font-mono text-amber-600 dark:text-gold-400">
              Indexing Quranic Text Database (6,236 Verses)...
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mode 1: Verse-Based Inputs */}
            {searchMode === 'verse' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {/* Searchable Surah Selector */}
                  <div className="md:col-span-6 flex flex-col gap-1.5 relative" ref={dropdownRef}>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span>Source Surah</span>
                      <span className="text-[10px] font-mono text-amber-600 dark:text-gold-400 font-bold">
                        Surah #{currentSurahObj.id}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setSurahDropdownOpen((prev) => !prev)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-left flex items-center justify-between shadow-sm hover:border-amber-500 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-gold-400 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-amber-500/20">
                          {currentSurahObj.id}
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {currentSurahObj.name}
                        </span>
                        <span className="font-arabic text-sm text-amber-600 dark:text-gold-400 shrink-0">
                          ({currentSurahObj.arabic})
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>

                    {/* Surah Picker Modal/Dropdown */}
                    {surahDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                          <input
                            type="text"
                            placeholder="Type Surah name or number (e.g. Baqarah, يس, 36)..."
                            value={surahSearchText}
                            onChange={(e) => setSurahSearchText(e.target.value)}
                            autoFocus
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500 text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
                          {filteredDropdownSurahs.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-500">
                              No matching Surahs found.
                            </div>
                          ) : (
                            filteredDropdownSurahs.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => handleSelectSurah(s)}
                                className={`w-full px-3.5 py-2.5 rounded-lg text-left flex items-center justify-between text-xs transition-colors ${
                                  s.id === currentSurahObj.id
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-gold-400 font-bold'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-slate-400 text-[11px] w-6">
                                    #{s.id}
                                  </span>
                                  <span className="font-semibold">{s.name}</span>
                                  <span className="font-arabic text-amber-600 dark:text-gold-400">
                                    ({s.arabic})
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {s.totalAyahs} ayahs
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ayah Input with dynamic helper range text */}
                  <div className="md:col-span-3 flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span>Verse Number</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Max: {currentSurahObj.totalAyahs}
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={currentSurahObj.totalAyahs}
                      value={ayahNum}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val)) setAyahNum('');
                        else setAyahNum(Math.max(1, Math.min(val, currentSurahObj.totalAyahs)));
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 text-sm font-bold focus:outline-none focus:border-amber-500 shadow-sm"
                    />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Surah {currentSurahObj.name} has {currentSurahObj.totalAyahs} verses (1–
                      {currentSurahObj.totalAyahs})
                    </span>
                  </div>

                  {/* Load Button */}
                  <div className="md:col-span-3 flex flex-col justify-end pt-1 md:pt-6">
                    <button
                      onClick={loadTarget}
                      className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all border border-amber-600/20"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Load Target Verse</span>
                    </button>
                  </div>
                </div>

                {/* Interactive Clickable Words in Target Verse */}
                {targetVerse && (
                  <div className="p-6 rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border border-dashed border-amber-400/40 dark:border-amber-500/30 space-y-3.5 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-500/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-gold-400">
                          Source Verse
                        </span>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          — Surah {targetVerse.surahName || currentSurahObj.name} (
                          {surahNum}):{targetVerse.numberInSurah}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-amber-600 dark:text-gold-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                        {selectedWords.size} words pinned
                      </span>
                    </div>

                    {/* Words Pill List */}
                    <div className="text-right py-3 leading-[2.6]" dir="rtl">
                      {targetVerse.text.split(/\s+/).filter(Boolean).map((w, idx) => {
                        const normW = normalize(w);
                        const isSelected = selectedWords.has(normW);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleWordClick(w)}
                            className={`inline-block mx-1.5 my-1 px-3 py-1 rounded-xl text-2xl font-arabic cursor-pointer transition-all hover:scale-105 select-none ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 font-extrabold border border-amber-400 shadow-md ring-2 ring-amber-500/40'
                                : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                          >
                            {w}
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>
                        Tap any word above to <strong>pin priority</strong>. When words are pinned in gold, only verses containing those exact words will match.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Direct Word & Multi-Word Phrase Search */}
            {searchMode === 'keyword' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                    <span>Search by Word, Phrase or Consecutive Sequence</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Supports Arabic with or without Tashkeel
                    </span>
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="اكتب كلمة أو عبارة قرآنية (مثال: هُدًى لِلْمُتَّقِينَ ، يَا أَيُّهَا الَّذِينَ آمَنُوا)..."
                      value={keywordQuery}
                      onChange={(e) => setKeywordQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') executeSearch();
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 dark:text-slate-100 font-arabic text-2xl focus:outline-none focus:border-amber-500 shadow-inner"
                    />
                    {keywordQuery && (
                      <button
                        onClick={() => setKeywordQuery('')}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Match Type Controls & Quick Suggestions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Matching Rule:
                    </span>
                    <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-1 text-xs">
                      {[
                        { id: 'phrase', label: 'Exact Phrase Sequence' },
                        { id: 'all', label: 'All Words Anywhere' },
                        { id: 'any', label: 'Any Word (Ranked)' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setKeywordMatchType(item.id)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                            keywordMatchType === item.id
                              ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-gold-400 shadow-sm border border-slate-200 dark:border-slate-700'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sample Query Badges */}
                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1" dir="rtl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">أمثلة:</span>
                    {[
                      'هُدًى لِلْمُتَّقِينَ',
                      'يَا أَيُّهَا الَّذِينَ آمَنُوا',
                      'إِنَّ فِي ذَٰلِكَ لَآيَاتٍ',
                      'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'
                    ].map((example, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setKeywordQuery(example);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-arabic text-sm text-slate-700 dark:text-slate-300 hover:border-amber-500 transition-colors shrink-0"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Universal Scope Controls (Juz / Surah / Page) */}
            <div className="border-t border-slate-200 dark:border-slate-800/80 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Search Scope Constraint
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Restrict similarity analysis to specific portions of the Quran.
                  </p>
                </div>

                <div className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-1.5">
                  {['juz', 'surah', 'page'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setScopeMode(mode)}
                      className={`px-4 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                        scopeMode === mode
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow border border-slate-200 dark:border-slate-700/60 font-extrabold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {mode === 'juz' && 'By Juz (1–30)'}
                      {mode === 'surah' && 'By Surah'}
                      {mode === 'page' && 'By Page Range'}
                    </button>
                  ))}
                </div>
              </div>

              {/* By Juz Selector */}
              {scopeMode === 'juz' && (
                <div className="space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Select Juz Filters ({selectedJuz.length === 0 ? 'All 30 Juz Included' : `${selectedJuz.length} Selected`})
                    </span>
                    {selectedJuz.length > 0 && (
                      <button
                        onClick={() => setSelectedJuz([])}
                        className="text-[10px] font-bold text-rose-500 hover:underline"
                      >
                        Clear Juz Filter
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2 w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    {Array.from({ length: 30 }, (_, index) => {
                      const j = index + 1;
                      const isChecked = selectedJuz.includes(j.toString());
                      return (
                        <label
                          key={j}
                          className={`flex items-center justify-center p-1.5 text-xs rounded-lg border font-mono font-bold cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300 shadow-sm'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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

              {/* By Surah Multi-Picker */}
              {scopeMode === 'surah' && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Select Specific Surahs ({selectedSurahs.length === 0 ? 'All 114 Included' : `${selectedSurahs.length} Selected`})
                    </span>
                    <input
                      type="text"
                      placeholder="Filter Surahs list..."
                      value={scopeSurahSearchText}
                      onChange={(e) => setScopeSurahSearchText(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 w-full sm:max-w-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    {filteredScopeSurahs.map((s) => {
                      const isChecked = selectedSurahs.includes(s.id.toString());
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-gold-400 font-bold'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            value={s.id}
                            checked={isChecked}
                            onChange={() => handleSurahToggle(s.id.toString())}
                            className="accent-amber-500 shrink-0"
                          />
                          <span className="font-mono text-[10px] text-slate-400">#{s.id}</span>
                          <span className="truncate">{s.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* By Page Range */}
              {scopeMode === 'page' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md animate-fadeIn">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Start Page (1–604)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="604"
                      value={pageRange.start}
                      onChange={(e) =>
                        setPageRange((prev) => ({
                          ...prev,
                          start: Math.max(1, parseInt(e.target.value, 10) || 1)
                        }))
                      }
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      End Page (1–604)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="604"
                      value={pageRange.end}
                      onChange={(e) =>
                        setPageRange((prev) => ({
                          ...prev,
                          end: Math.min(604, parseInt(e.target.value, 10) || 604)
                        }))
                      }
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Execute Search Action Button */}
            <div className="border-t border-slate-200 dark:border-slate-800/80 pt-5 flex justify-end">
              <button
                onClick={executeSearch}
                disabled={searchMode === 'verse' ? !targetVerse : !keywordQuery.trim()}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-md transition-all disabled:opacity-40"
              >
                <Search className="w-4 h-4" />
                <span>
                  {searchMode === 'verse' ? 'Find Mutashabehat Matches' : 'Search Words Across Quran'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {hasSearched && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-600 dark:text-slate-300 font-mono tracking-wider uppercase">
              Found {matches.length} similarity occurrence{matches.length !== 1 ? 's' : ''}:
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Ranked by verbal density & exactness
            </span>
          </div>

          {matches.length === 0 ? (
            <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-xs font-semibold animate-fadeIn space-y-2">
              <p>No matching verses found matching the specified parameters.</p>
              <p className="text-[11px] text-slate-400">
                Try widening your search scope or changing the matching rule.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {matches.map((m, index) => (
                <div
                  key={index}
                  className={`bg-white dark:bg-slate-950 border rounded-2xl p-6 shadow-sm flex flex-col space-y-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 ${
                    m.isExact
                      ? 'border-amber-500/50 bg-amber-500/[0.02] dark:bg-amber-950/[0.04]'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Result Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 dark:border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {m.isExact ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-gold-400 font-extrabold text-[11px] font-mono tracking-wider border border-amber-500/30">
                          ★ EXACT PHRASE MATCH
                        </span>
                      ) : m.matchType === 'priority' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px] font-mono tracking-wider border border-emerald-500/30">
                          ★ PINNED PRIORITY MATCH
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] font-mono tracking-wider border border-slate-200 dark:border-slate-700">
                          SIMILARITY MATCH
                        </span>
                      )}

                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono">
                        Surah {m.surahName} ({m.surahNum}), Ayah {m.numberInSurah} • Juz {m.juz} • Page {m.page}
                      </span>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setModalTarget({
                            page: m.page,
                            surahNum: m.surahNum,
                            ayahNum: m.numberInSurah,
                            surahName: m.surahName,
                            text: m.text
                          });
                          setModalZoom(1);
                        }}
                        className="px-3.5 py-1.5 rounded-xl border border-amber-500/40 text-amber-700 dark:text-gold-400 bg-amber-500/10 hover:bg-amber-500/20 font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                        title="View manuscript page with highlighted verse"
                      >
                        <Sparkle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        <span>Highlight in Manuscript (P. {m.page})</span>
                      </button>

                      <button
                        onClick={() => handleJumpToTab('tilawat', m.page)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                        title="Open this page in Tilawat Mushaf"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Open in Tilawat</span>
                      </button>

                      <button
                        onClick={() => handleJumpToTab('tasmee', m.page)}
                        className="px-3 py-1.5 rounded-xl border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15 font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                        title="Open this page in Tasmee Live Recitation"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Open in Tasmee</span>
                      </button>
                    </div>
                  </div>

                  {/* Primary Typography Quranic Text Card */}
                  <div className="text-right leading-[2.6] font-arabic text-2xl sm:text-3xl py-2 px-1 select-text" dir="rtl">
                    {renderHighlightedVerse(m.text)}
                    <span className="inline-block mx-2 font-arabic text-xl text-amber-600 dark:text-gold-400 select-none">
                      ﴿{toArabicDigits(m.numberInSurah)}﴾
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manuscript Lightbox Modal with Exact Ayah Highlighting */}
      {modalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-gold-400 border border-amber-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Surah {modalTarget.surahName} ({modalTarget.surahNum}), Ayah {modalTarget.ayahNum}</span>
                    <span className="text-xs text-amber-600 dark:text-gold-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      Page {modalTarget.page}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Matched verse highlighted with glowing bounds on the Madani manuscript.
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalZoom((z) => Math.max(0.8, Number((z - 0.2).toFixed(1))))}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold text-slate-500 w-10 text-center">
                  {Math.round(modalZoom * 100)}%
                </span>
                <button
                  onClick={() => setModalZoom((z) => Math.min(2.0, Number((z + 0.2).toFixed(1))))}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    handleJumpToTab('tilawat', modalTarget.page);
                    setModalTarget(null);
                  }}
                  className="hidden sm:flex px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs items-center gap-1.5 shadow"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tilawat</span>
                </button>

                <button
                  onClick={() => {
                    setModalTarget(null);
                    setModalZoom(1);
                  }}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image Body with Precise Bounding Box Highlight Overlay */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 dark:bg-slate-950 select-none relative min-h-[400px]">
              {loadingModalBoxes ? (
                <div className="flex flex-col items-center justify-center gap-3 text-amber-500 py-20">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                  <span className="text-xs font-semibold font-mono uppercase tracking-wider">
                    Mapping Manuscript Coordinate Boxes...
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

                  {/* Overlaid Highlight Boxes for the exact matched ayah */}
                  {modalBoxes.map((box, idx) => {
                    const isTargetAyah =
                      Number(box.sura) === Number(modalTarget.surahNum) &&
                      Number(box.ayah) === Number(modalTarget.ayahNum);

                    const leftPct = (box.min_x / modalDimensions.width) * 100;
                    const topPct = (box.min_y / modalDimensions.height) * 100;
                    const widthPct = ((box.max_x - box.min_x) / modalDimensions.width) * 100;
                    const heightPct = ((box.max_y - box.min_y) / modalDimensions.height) * 100;

                    if (!isTargetAyah) return null;

                    return (
                      <div
                        key={`modal-box-${box.global_id}-${idx}`}
                        className="absolute z-20 rounded-md bg-amber-400/35 dark:bg-amber-400/40 border-2 border-amber-500 shadow-gold-glow ring-2 ring-amber-400/50 animate-pulse transition-all"
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`
                        }}
                      >
                        {/* Accent glowing underline bar */}
                        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-amber-500 rounded-full shadow-md" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Bottom Verse Preview Bar */}
            <div
              className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-amber-50/40 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-right shadow-inner"
              dir="rtl"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                <span className="font-arabic text-xl sm:text-2xl font-bold text-amber-700 dark:text-gold-400 truncate">
                  {modalTarget.text}
                </span>
                <span className="font-arabic text-base text-amber-600 dark:text-gold-400 shrink-0">
                  ﴿{toArabicDigits(modalTarget.ayahNum)}﴾
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 shrink-0 select-none" dir="ltr">
                <span>Highlighted on Manuscript Page {modalTarget.page}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MutashabehatTab;
