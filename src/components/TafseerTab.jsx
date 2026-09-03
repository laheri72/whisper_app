import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  BookOpen, Search, Volume2, Play, Pause, ChevronLeft, ChevronRight, 
  RotateCcw, Sparkles, FileText, Copy, Check, ZoomIn, ZoomOut, 
  Layers, Filter, Info, Eye, ExternalLink, Shuffle, RefreshCw,
  Compass, Bookmark, Award, HelpCircle, X, ChevronDown, ChevronUp,
  Library, BookMarked, ArrowLeft, ArrowRight, Share2, Quote, Lightbulb,
  ListFilter, Target
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FULL_SURAH_LIST, JUZ_LIST, getJuzPageRange } from '../utils/juzMapping';

export const TafseerTab = ({ activeTab }) => {
  const {
    tafseerState = {},
    updateTafseer = () => {},
    setActiveTab = () => {},
    updateTilawat = () => {},
    updateMutashabehat = () => {}
  } = useApp() || {};

  const {
    surahNum = 1,
    ayahNum = 1,
    activeTafsir = 'ja',
    viewMode = 'tabbed',
    searchQuery = '',
    searchScholar = 'all',
    fontSizeOffset = 0,
    searchScope = 'all'
  } = tafseerState;

  // Local helper to update persistent state
  const safeUpdate = typeof updateTafseer === 'function' ? updateTafseer : () => {};
  const setSurahNum = (val) => safeUpdate({ surahNum: val });
  const setAyahNum = (val) => safeUpdate({ ayahNum: val });
  const setActiveTafsir = (val) => safeUpdate({ activeTafsir: val });
  const setViewMode = (val) => safeUpdate({ viewMode: val });
  const setSearchQuery = (val) => safeUpdate({ searchQuery: val });
  const setSearchScholar = (val) => safeUpdate({ searchScholar: val });
  const setFontSizeOffset = (val) => safeUpdate(prev => ({ fontSizeOffset: typeof val === 'function' ? val(prev?.fontSizeOffset || 0) : val }));
  const setSearchScope = (val) => safeUpdate({ searchScope: val });

  // Main navigation modes: 'explorer' | 'search' | 'reader'
  const [navMode, setNavMode] = useState('explorer');

  // Verse Data state
  const [verseData, setVerseData] = useState(null);
  const [loadingVerse, setLoadingVerse] = useState(false);
  const [verseError, setVerseError] = useState('');

  // Surah Reader data state & filter
  const [surahVerses, setSurahVerses] = useState([]);
  const [loadingSurah, setLoadingSurah] = useState(false);
  const [expandedReaderAyahs, setExpandedReaderAyahs] = useState(new Set([1]));
  const [readerFilterScope, setReaderFilterScope] = useState('all'); // 'all' | 'selected'

  // Search Results State
  const [searchResults, setSearchResults] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchInputText, setSearchInputText] = useState(searchQuery || '');
  const [searchLimit, setSearchLimit] = useState(30);

  // In-Tafseer word filter / highlight
  const [inPageFilter, setInPageFilter] = useState('');

  // Audio Playback State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  const audioRef = useRef(null);

  // Manuscript Modal State
  const [showManuscriptModal, setShowManuscriptModal] = useState(false);
  const [modalBoxes, setModalBoxes] = useState([]);
  const [loadingModalBoxes, setLoadingModalBoxes] = useState(false);
  const [modalDimensions, setModalDimensions] = useState({ width: 1000, height: 1000 });

  // Dropdown states & click-outside refs
  const [surahDropdownOpen, setSurahDropdownOpen] = useState(false);
  const [ayahDropdownOpen, setAyahDropdownOpen] = useState(false);
  const [surahSearchFilter, setSurahSearchFilter] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const surahDropdownRef = useRef(null);
  const ayahDropdownRef = useRef(null);

  // Auto close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (surahDropdownRef.current && !surahDropdownRef.current.contains(e.target)) {
        setSurahDropdownOpen(false);
      }
      if (ayahDropdownRef.current && !ayahDropdownRef.current.contains(e.target)) {
        setAyahDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Multi-card comparison expanded states
  const [expandedTafsirs, setExpandedTafsirs] = useState({
    ja: true,
    ik: true,
    qu: true,
    sa: true,
    ta: true
  });

  // Current Surah metadata
  const currentSurahMeta = useMemo(() => {
    return FULL_SURAH_LIST.find(s => s.id === surahNum) || FULL_SURAH_LIST[0];
  }, [surahNum]);

  // Audio cleanup on tab change or unmount
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsPlayingAudio(false);
  }, []);

  useEffect(() => {
    if (activeTab && activeTab !== 'tafseer') {
      stopAudio();
    }
  }, [activeTab, stopAudio]);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  // Fetch current verse exegesis
  const fetchVerse = useCallback(async (sNum, aNum) => {
    setLoadingVerse(true);
    setVerseError('');
    try {
      const res = await fetch(`/api/tafsir/verse/${sNum}/${aNum}`);
      if (res.ok) {
        const data = await res.json();
        setVerseData(data);
      } else {
        setVerseError('Failed to load verse exegesis.');
      }
    } catch (err) {
      console.error('Error fetching tafsir verse:', err);
      setVerseError('Error connecting to Tafsir database.');
    } finally {
      setLoadingVerse(false);
    }
  }, []);

  useEffect(() => {
    fetchVerse(surahNum, ayahNum);
  }, [surahNum, ayahNum, fetchVerse]);

  // Fetch surah verses for reader mode
  const fetchSurahReader = useCallback(async (sNum) => {
    setLoadingSurah(true);
    try {
      const res = await fetch(`/api/tafsir/surah/${sNum}`);
      if (res.ok) {
        const data = await res.json();
        setSurahVerses(data.verses || []);
      }
    } catch (err) {
      console.error('Error loading surah reader:', err);
    } finally {
      setLoadingSurah(false);
    }
  }, []);

  useEffect(() => {
    if (navMode === 'reader') {
      fetchSurahReader(surahNum);
    }
  }, [surahNum, navMode, fetchSurahReader]);

  // Auto-expand selected verse in Surah Reader and auto-scroll when in 'all' mode
  useEffect(() => {
    if (navMode === 'reader') {
      setExpandedReaderAyahs(prev => new Set([...prev, ayahNum]));
      if (readerFilterScope === 'all') {
        const timer = setTimeout(() => {
          const el = document.getElementById(`ayah-reader-card-${ayahNum}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [ayahNum, navMode, readerFilterScope]);

  // Displayed reader verses based on scope filter
  const displayedReaderVerses = useMemo(() => {
    if (readerFilterScope === 'selected') {
      return surahVerses.filter(v => v.ayah_no === ayahNum);
    }
    return surahVerses;
  }, [surahVerses, readerFilterScope, ayahNum]);

  // Fetch bounding boxes for manuscript modal
  useEffect(() => {
    if (!showManuscriptModal || !verseData?.page_no) return;
    let isMounted = true;
    setLoadingModalBoxes(true);
    fetch(`/api/page_boxes/${verseData.page_no}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted) setModalBoxes(data.boxes || []);
      })
      .catch(err => {
        console.error('Modal boxes fetch error:', err);
        if (isMounted) setModalBoxes([]);
      })
      .finally(() => {
        if (isMounted) setLoadingModalBoxes(false);
      });

    return () => { isMounted = false; };
  }, [showManuscriptModal, verseData?.page_no]);

  // Audio Playback Controller
  const playVerseAudio = (url) => {
    stopAudio();
    if (!url) return;

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.playbackRate = playbackSpeed;

    audio.onended = () => {
      if (isLooping) {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else if (autoNext && verseData?.next_verse) {
        handleNextVerse();
      } else {
        setIsPlayingAudio(false);
      }
    };

    audio.onerror = (e) => {
      console.error('Audio playback error:', e);
      setIsPlayingAudio(false);
    };

    audio.play().then(() => {
      setIsPlayingAudio(true);
    }).catch(err => {
      console.warn('Audio play request interrupted:', err);
      setIsPlayingAudio(false);
    });
  };

  const toggleAudio = () => {
    if (isPlayingAudio) {
      stopAudio();
    } else if (verseData?.audio_url) {
      playVerseAudio(verseData.audio_url);
    }
  };

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  // Verse navigation handlers
  const handlePrevVerse = () => {
    if (verseData?.prev_verse) {
      setSurahNum(verseData.prev_verse.surah);
      setAyahNum(verseData.prev_verse.ayah);
    } else if (ayahNum > 1) {
      setAyahNum(ayahNum - 1);
    }
  };

  const handleNextVerse = () => {
    if (verseData?.next_verse) {
      setSurahNum(verseData.next_verse.surah);
      setAyahNum(verseData.next_verse.ayah);
    } else if (ayahNum < currentSurahMeta.totalAyahs) {
      setAyahNum(ayahNum + 1);
    }
  };

  const handleRandomVerse = () => {
    const randomSurah = FULL_SURAH_LIST[Math.floor(Math.random() * FULL_SURAH_LIST.length)];
    const randomAyah = Math.floor(Math.random() * randomSurah.totalAyahs) + 1;
    setSurahNum(randomSurah.id);
    setAyahNum(randomAyah);
  };

  // Keyboard Navigation: Arrow Left/Right to change verses; 1-5 to toggle Tafseer chips
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'ArrowRight') {
        handlePrevVerse();
      } else if (e.key === 'ArrowLeft') {
        handleNextVerse();
      } else if (e.key === '1') {
        setActiveTafsir('ja');
      } else if (e.key === '2') {
        setActiveTafsir('ik');
      } else if (e.key === '3') {
        setActiveTafsir('qu');
      } else if (e.key === '4') {
        setActiveTafsir('sa');
      } else if (e.key === '5') {
        setActiveTafsir('ta');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Deep Search Handler
  const executeSearch = async (resetOffset = true) => {
    const query = searchInputText.trim();
    if (!query || query.length < 2) return;

    setLoadingSearch(true);
    setSearchQuery(query);

    let url = `/api/tafsir/search?q=${encodeURIComponent(query)}&scholar=${searchScholar}&limit=${searchLimit}`;
    if (searchScope === 'current_surah') {
      url += `&surah_no=${surahNum}`;
    } else if (searchScope === 'current_juz' && verseData?.juz) {
      url += `&juz=${verseData.juz}`;
    }

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      } else {
        setSearchResults(null);
      }
    } catch (err) {
      console.error('Search execution failed:', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  // Jump from Search hit directly to Explorer view
  const openSearchResultInExplorer = (hit, preferredScholar = null) => {
    setSurahNum(hit.surah_no);
    setAyahNum(hit.ayah_no);
    if (preferredScholar && preferredScholar !== 'quran') {
      setActiveTafsir(preferredScholar);
    }
    setNavMode('explorer');
  };

  // Jump to Misri Mushaf in TilawatTab
  const jumpToTilawatManuscript = (pageNumber) => {
    updateTilawat({ pageNumber });
    setActiveTab('tilawat');
  };

  // Jump to MutashabehatTab
  const jumpToMutashabehat = (sNum, aNum) => {
    updateMutashabehat({
      searchMode: 'verse',
      surahNum: sNum,
      ayahNum: aNum
    });
    setActiveTab('mutashabehat');
  };

  // Copy Ayah & Commentary Text
  const copyCurrentTafsir = () => {
    if (!verseData) return;
    const currentTafsirObj = verseData.tafsir?.[activeTafsir];
    const textToCopy = `📖 ${verseData.surah_name} (${verseData.surah_no}:${verseData.ayah_no})
${verseData.ayaat_mt}

📚 ${currentTafsirObj?.name || 'التفسير'}:
${currentTafsirObj?.text || 'غير متوفر'}

- تم النسخ من البوابة القرآنية الشاملة`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // Filtered list of Surahs for search dropdown
  const filteredSurahList = useMemo(() => {
    if (!surahSearchFilter) return FULL_SURAH_LIST;
    const q = surahSearchFilter.toLowerCase();
    return FULL_SURAH_LIST.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.arabic.includes(q) || 
      String(s.id).includes(q)
    );
  }, [surahSearchFilter]);

  // Scholar styling & metadata lookup with distinct vibrant themes for Light & Dark mode
  const scholarConfigs = {
    ja: {
      id: 'ja',
      keyNum: '1',
      name: 'الجلالين',
      fullName: 'تفسير الجلالين',
      author: 'جلال الدين المحلي وجلال الدين السيوطي',
      era: 'القرن 10 هـ',
      methodology: 'إيجاز لغوي وتوضيح سياقي مباشر للكلمات والآيات',
      tag: 'وجيز وموجز',
      activeChip: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 font-extrabold shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400',
      inactiveChip: 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-slate-900/90 dark:text-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 shadow-sm',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
      borderClass: 'border-emerald-500/40'
    },
    ik: {
      id: 'ik',
      keyNum: '2',
      name: 'ابن كثير',
      fullName: 'تفسير القرآن العظيم (ابن كثير)',
      author: 'الحافظ عماد الدين ابن كثير (774 هـ)',
      era: '774 هـ',
      methodology: 'تفسير القرآن بالقرآن والسنة النبوية والآثار المأثورة',
      tag: 'مأثور وأثر',
      activeChip: 'bg-amber-500 text-slate-950 dark:bg-amber-500 dark:text-slate-950 font-extrabold shadow-md shadow-amber-500/25 ring-2 ring-amber-400',
      inactiveChip: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-slate-900/90 dark:text-amber-300 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-950/40 shadow-sm',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
      borderClass: 'border-amber-500/40'
    },
    qu: {
      id: 'qu',
      keyNum: '3',
      name: 'القرطبي',
      fullName: 'الجامع لأحكام القرآن (القرطبي)',
      author: 'الإمام أبو عبد الله القرطبي (671 هـ)',
      era: '671 هـ',
      methodology: 'استنباط الأحكام الفقهية وتفصيل المسائل اللغوية والبلاغية',
      tag: 'فقه وأحكام',
      activeChip: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950 font-extrabold shadow-md shadow-blue-500/25 ring-2 ring-blue-400',
      inactiveChip: 'bg-blue-50 text-blue-900 border-blue-300 dark:bg-slate-900/90 dark:text-blue-300 dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-950/40 shadow-sm',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
      borderClass: 'border-blue-500/40'
    },
    sa: {
      id: 'sa',
      keyNum: '4',
      name: 'السعدي',
      fullName: 'تيسير الكريم الرحمن (السعدي)',
      author: 'الشيخ عبد الرحمن بن ناصر السعدي (1376 هـ)',
      era: '1376 هـ',
      methodology: 'إبراز المعاني الإيمانية والتربوية بعبارة ميسرة مقصودة',
      tag: 'تربوي وميسر',
      activeChip: 'bg-purple-600 text-white dark:bg-purple-500 dark:text-white font-extrabold shadow-md shadow-purple-500/25 ring-2 ring-purple-400',
      inactiveChip: 'bg-purple-50 text-purple-900 border-purple-300 dark:bg-slate-900/90 dark:text-purple-300 dark:border-purple-500/30 hover:bg-purple-100 dark:hover:bg-purple-950/40 shadow-sm',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
      borderClass: 'border-purple-500/40'
    },
    ta: {
      id: 'ta',
      keyNum: '5',
      name: 'الطبري',
      fullName: 'جامع البيان عن تأويل آي القرآن (الطبري)',
      author: 'الإمام محمد بن جرير الطبري (310 هـ)',
      era: '310 هـ',
      methodology: 'عمدة التفاسير ومرجع الروايات المسندة واللغات والإعراب',
      tag: 'جامع الروايات',
      activeChip: 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950 font-extrabold shadow-md shadow-teal-500/25 ring-2 ring-teal-400',
      inactiveChip: 'bg-teal-50 text-teal-900 border-teal-300 dark:bg-slate-900/90 dark:text-teal-300 dark:border-teal-500/30 hover:bg-teal-100 dark:hover:bg-teal-950/40 shadow-sm',
      badgeClass: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-500/15 dark:text-teal-400 dark:border-teal-500/30',
      borderClass: 'border-teal-500/40'
    }
  };

  // Highlighting filter words in commentary with rich classical typography
  const renderFormattedTafsirText = (text, filterQuery) => {
    if (!text) return null;
    if (!filterQuery || filterQuery.length < 2) {
      return (
        <div className="whitespace-pre-wrap leading-[2.4] select-text font-tafsir text-slate-800 dark:text-slate-100 text-right" dir="rtl">
          {text}
        </div>
      );
    }
    try {
      const parts = text.split(new RegExp(`(${filterQuery})`, 'gi'));
      return (
        <div className="whitespace-pre-wrap leading-[2.4] select-text font-tafsir text-slate-800 dark:text-slate-100 text-right" dir="rtl">
          {parts.map((part, i) => 
            part.toLowerCase() === filterQuery.toLowerCase() ? (
              <mark key={i} className="bg-amber-300 text-slate-950 dark:bg-amber-400 dark:text-slate-950 font-extrabold px-1.5 py-0.5 rounded shadow-sm">
                {part}
              </mark>
            ) : part
          )}
        </div>
      );
    } catch (e) {
      return <div className="whitespace-pre-wrap leading-[2.4] font-tafsir text-right" dir="rtl">{text}</div>;
    }
  };

  return (
    <div className="space-y-4 pb-16 select-none relative">
      {/* 1. TOP HEADER & MAIN TAB MODES (Sticky Navigation with high Z-Index) */}
      <div className="sticky top-0 z-40 glass-panel rounded-2xl p-3.5 md:p-4 border shadow-xl flex flex-wrap items-center justify-between gap-3 backdrop-blur-xl">
        {/* Left: Branding & Academic Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 via-teal-600 to-teal-800 p-0.5 shadow-md flex items-center justify-center flex-shrink-0">
            <div className="w-full h-full rounded-[9px] bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
              <Library className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-wide">
                Tafseer Hub
              </h2>
              <span className="font-arabic text-teal-700 dark:text-teal-400 text-xs md:text-sm font-bold bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-500/20">
                مكتبة التفسير الشاملة
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              5 Classical Commentaries &bull; Multi-Scholar Chips &bull; Instant Audio Recitation
            </p>
          </div>
        </div>

        {/* Right: Main Navigation Mode CTA Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setNavMode('explorer')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              navMode === 'explorer'
                ? 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Verse Explorer</span>
          </button>

          <button
            onClick={() => setNavMode('search')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              navMode === 'search'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Deep Search</span>
          </button>

          <button
            onClick={() => setNavMode('reader')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              navMode === 'reader'
                ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Surah Reader</span>
          </button>
        </div>
      </div>

      {/* 2. SURAH / AYAH / JUZ SELECTOR BAR (Non-Clipping, Robust Dropdowns with Z-Index 50) */}
      <div className="relative z-30 glass-panel rounded-2xl p-3 md:p-4 border shadow-md flex flex-wrap items-center justify-between gap-3 overflow-visible">
        {/* Left Side: Surah Dropdown & Ayah Quick Selectors */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px] overflow-visible">
          {/* Surah Dropdown Button */}
          <div className="relative" ref={surahDropdownRef}>
            <button
              onClick={() => {
                setSurahDropdownOpen(!surahDropdownOpen);
                setAyahDropdownOpen(false);
              }}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/80 text-xs font-bold flex items-center gap-2 hover:border-teal-500 transition-colors shadow-sm"
            >
              <span className="w-6 h-6 rounded-md bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center font-extrabold text-[11px] font-mono">
                {surahNum}
              </span>
              <span className="text-slate-900 dark:text-slate-100 font-bold">
                {currentSurahMeta.name}
              </span>
              <span className="font-arabic text-amber-600 dark:text-amber-400 text-sm font-bold">
                {currentSurahMeta.arabic}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${surahDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Floating Non-Clipping Surah Menu */}
            {surahDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 max-h-80 bg-white dark:bg-slate-900 border-2 border-teal-500/50 rounded-2xl shadow-2xl z-[70] overflow-hidden flex flex-col p-2.5 animate-fadeIn">
                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="Search Surah (e.g. Baqarah, 2)..."
                    value={surahSearchFilter}
                    onChange={(e) => setSurahSearchFilter(e.target.value)}
                    className="w-full px-3 py-2 pl-8 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                    autoFocus
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredSurahList.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSurahNum(s.id);
                        setAyahNum(1);
                        setSurahDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        surahNum === s.id
                          ? 'bg-teal-500 text-slate-950 font-extrabold shadow'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <span className="font-medium">{s.id}. {s.name} ({s.totalAyahs} v.)</span>
                      <span className="font-arabic text-amber-600 dark:text-amber-400 font-bold">{s.arabic}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ayah Dropdown Button */}
          <div className="relative" ref={ayahDropdownRef}>
            <button
              onClick={() => {
                setAyahDropdownOpen(!ayahDropdownOpen);
                setSurahDropdownOpen(false);
              }}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/80 text-xs font-bold flex items-center gap-1.5 hover:border-teal-500 transition-colors shadow-sm"
            >
              <span className="text-slate-500 dark:text-slate-400">Ayah:</span>
              <span className="text-teal-600 dark:text-teal-300 font-mono font-extrabold">{ayahNum}</span>
              <span className="text-slate-500 text-[10px]">/ {currentSurahMeta.totalAyahs}</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {/* Floating Ayah Grid Dropdown */}
            {ayahDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 max-h-72 bg-white dark:bg-slate-900 border-2 border-teal-500/50 rounded-2xl shadow-2xl z-[70] overflow-y-auto p-3 grid grid-cols-5 gap-1.5 custom-scrollbar animate-fadeIn">
                {Array.from({ length: currentSurahMeta.totalAyahs }, (_, i) => i + 1).map(a => (
                  <button
                    key={a}
                    onClick={() => {
                      setAyahNum(a);
                      setAyahDropdownOpen(false);
                    }}
                    className={`h-9 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center ${
                      ayahNum === a
                        ? 'bg-teal-500 text-slate-950 font-extrabold shadow'
                        : 'bg-slate-50 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-200'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Metadata Badges */}
          {verseData && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                Juz {verseData.juz}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                Page {verseData.page_no}
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Prev / Next Ayah CTA Buttons with Tooltips */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrevVerse}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:text-teal-600 dark:hover:text-teal-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="Previous Verse (Arrow Right)"
          >
            <ChevronRight className="w-4 h-4" />
            <span className="hidden md:inline">Prev</span>
          </button>

          <button
            onClick={handleRandomVerse}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-amber-500 transition-all shadow-sm active:scale-95"
            title="Random Verse (Shuffle)"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={handleNextVerse}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:text-teal-600 dark:hover:text-teal-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="Next Verse (Arrow Left)"
          >
            <span className="hidden md:inline">Next</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODE 1: VERSE EXPLORER VIEW                                            */}
      {/* ========================================================================= */}
      {navMode === 'explorer' && (
        <div className="space-y-4">
          {/* Active Verse Hero Card */}
          {loadingVerse ? (
            <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center gap-3 text-teal-600 dark:text-teal-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-sm font-bold">Loading Verse Exegesis...</span>
            </div>
          ) : verseData ? (
            <div className="glass-panel-gold rounded-3xl p-5 md:p-7 border shadow-xl relative overflow-hidden transition-all duration-200 space-y-5">
              {/* Card Meta & Action CTAs Header */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-3 gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 text-white dark:from-teal-500 dark:to-teal-600 dark:text-slate-950 text-xs font-extrabold font-mono shadow-sm">
                    {verseData.surah_no}:{verseData.ayah_no}
                  </span>
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Surah {verseData.surah_name} ({currentSurahMeta.name})
                  </span>
                </div>

                {/* Quick Utility CTAs */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Font Zoom Pill */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-300 dark:border-slate-800 p-0.5 text-xs">
                    <button
                      onClick={() => setFontSizeOffset(prev => Math.max(-4, prev - 2))}
                      className="px-2.5 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white font-bold"
                      title="Decrease Font Size"
                    >
                      A-
                    </button>
                    <span className="px-1 text-[10px] text-slate-500 font-mono">Zoom</span>
                    <button
                      onClick={() => setFontSizeOffset(prev => Math.min(10, prev + 2))}
                      className="px-2.5 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white font-bold"
                      title="Increase Font Size"
                    >
                      A+
                    </button>
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={copyCurrentTafsir}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                  </button>

                  {/* Misri Manuscript Button */}
                  <button
                    onClick={() => setShowManuscriptModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-300 dark:border-amber-500/40 text-xs font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Misri Manuscript (P. {verseData.page_no})</span>
                  </button>

                  {/* Mutashabehat Shortcut */}
                  <button
                    onClick={() => jumpToMutashabehat(verseData.surah_no, verseData.ayah_no)}
                    className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 border border-purple-300 dark:border-purple-500/40 text-xs font-extrabold text-purple-900 dark:text-purple-300 flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Similar Verses</span>
                  </button>
                </div>
              </div>

              {/* Uthmani Calligraphy Text */}
              <div 
                className="font-quran text-center text-slate-900 dark:text-slate-100 py-3 px-4 leading-[2.8] select-text transition-all drop-shadow-sm"
                style={{ fontSize: `${1.85 + fontSizeOffset * 0.12}rem` }}
              >
                {verseData.ayaat_mt}
              </div>

              {/* Audio Player & View Mode Controls Bar */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={toggleAudio}
                    className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 ${
                      isPlayingAudio
                        ? 'bg-amber-500 text-slate-950 shadow-gold-glow animate-pulse'
                        : 'bg-gradient-to-r from-teal-600 to-teal-700 text-white dark:from-teal-500 dark:to-teal-600 dark:text-slate-950'
                    }`}
                  >
                    {isPlayingAudio ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlayingAudio ? 'Pause Recitation' : 'Play Ayah Audio'}</span>
                  </button>

                  <button
                    onClick={cycleSpeed}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-teal-500 shadow-sm"
                    title="Audio Playback Speed"
                  >
                    {playbackSpeed.toFixed(2)}x
                  </button>

                  <button
                    onClick={() => setIsLooping(!isLooping)}
                    className={`p-2 rounded-lg border text-xs transition-colors shadow-sm ${
                      isLooping 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500' 
                        : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
                    }`}
                    title="Repeat Verse"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isLooping ? 'animate-spin-slow' : ''}`} />
                  </button>
                </div>

                {/* View Mode Switcher: Tabbed vs Comparative Matrix */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setViewMode('tabbed')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      viewMode === 'tabbed'
                        ? 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Single Scholar View</span>
                  </button>
                  <button
                    onClick={() => setViewMode('comparative')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      viewMode === 'comparative'
                        ? 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Side-by-Side Matrix</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* ======================================================================= */}
          {/* 4. PROMINENT TAFSIR SCHOLAR CHIP NAVIGATOR (PRIMARY REQUEST)            */}
          {/* ======================================================================= */}
          {viewMode === 'tabbed' && verseData && (
            <div className="space-y-3">
              {/* The 5 Prominent Scholar Chips */}
              <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {Object.keys(scholarConfigs).map(sKey => {
                    const cfg = scholarConfigs[sKey];
                    const tafsirObj = verseData.tafsir?.[sKey];
                    const isAvailable = tafsirObj?.available;
                    const isActive = activeTafsir === sKey;

                    return (
                      <button
                        key={sKey}
                        onClick={() => setActiveTafsir(sKey)}
                        className={`px-4 py-2.5 rounded-xl border text-xs flex items-center gap-2.5 transition-all active:scale-95 ${
                          isActive
                            ? cfg.activeChip
                            : cfg.inactiveChip
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-black/20 dark:bg-slate-950/40 text-[10px] font-mono font-bold flex items-center justify-center">
                          {cfg.keyNum}
                        </span>
                        <span className="font-arabic font-extrabold text-sm">{cfg.fullName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-slate-950/50 font-mono">
                          {cfg.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="text-[11px] text-slate-500 font-mono hidden lg:block px-2">
                  Tip: Press keys <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">1</kbd>-<kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">5</kbd> to toggle
                </div>
              </div>

              {/* Active Scholar Exegesis Card */}
              {verseData.tafsir?.[activeTafsir] && (
                <div className="glass-panel rounded-3xl p-6 md:p-8 border shadow-xl space-y-5">
                  {/* Scholar Profile & In-Page Search Header */}
                  <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl shadow-inner">
                        📖
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-arabic font-extrabold text-lg md:text-xl text-slate-900 dark:text-slate-100">
                            {scholarConfigs[activeTafsir].fullName}
                          </h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${scholarConfigs[activeTafsir].badgeClass}`}>
                            {scholarConfigs[activeTafsir].era}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          {scholarConfigs[activeTafsir].methodology}
                        </p>
                      </div>
                    </div>

                    {/* Word Filter within Commentary */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search in this commentary..."
                        value={inPageFilter}
                        onChange={(e) => setInPageFilter(e.target.value)}
                        className="px-3.5 py-2 pl-9 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500 w-48 sm:w-64 shadow-inner"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      {inPageFilter && (
                        <button
                          onClick={() => setInPageFilter('')}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Commentary Text Content Area (Rich Font Rendering) */}
                  <div 
                    className="p-6 md:p-8 rounded-2xl bg-amber-50/30 dark:bg-slate-950/60 border border-amber-200/80 dark:border-slate-800/90 shadow-inner"
                    style={{ fontSize: `${1.25 + fontSizeOffset * 0.08}rem` }}
                  >
                    {verseData.tafsir[activeTafsir].available ? (
                      renderFormattedTafsirText(verseData.tafsir[activeTafsir].text, inPageFilter)
                    ) : (
                      <div className="text-center py-10 space-y-3 text-slate-500 dark:text-slate-400">
                        <Lightbulb className="w-9 h-9 mx-auto text-purple-600 dark:text-purple-400" />
                        <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          تفسير السعدي يورد معنى هذه الآية ضمن سياق المقطع الشامل.
                        </h5>
                        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                          يمكنك النقر على رقائق المفسرين أعلاه لمطالعة تفسير الجلالين أو ابن كثير أو القرطبي أو الطبري للتفصيل المباشر لهذه الآية.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================================= */}
          {/* 5. COMPARATIVE MULTI-SCHOLAR VIEW MATRIX                                */}
          {/* ======================================================================= */}
          {viewMode === 'comparative' && verseData && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between px-2 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Comparative Matrix (All 5 Classical Exegeses)</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedTafsirs({ ja: true, ik: true, qu: true, sa: true, ta: true })}
                    className="text-teal-600 dark:text-teal-400 hover:underline font-bold"
                  >
                    Expand All
                  </button>
                  <span className="text-slate-400 dark:text-slate-600">|</span>
                  <button
                    onClick={() => setExpandedTafsirs({ ja: false, ik: false, qu: false, sa: false, ta: false })}
                    className="text-slate-600 dark:text-slate-400 hover:underline font-bold"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {Object.keys(scholarConfigs).map(sKey => {
                const cfg = scholarConfigs[sKey];
                const tafsirObj = verseData.tafsir?.[sKey];
                const isOpen = expandedTafsirs[sKey];

                return (
                  <div
                    key={sKey}
                    className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all shadow-md"
                  >
                    <button
                      onClick={() => setExpandedTafsirs(prev => ({ ...prev, [sKey]: !prev[sKey] }))}
                      className="w-full p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${tafsirObj?.available ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <div>
                          <h5 className="font-arabic font-extrabold text-base text-slate-900 dark:text-slate-100">{cfg.fullName}</h5>
                          <span className="text-xs text-slate-600 dark:text-slate-400">{cfg.author} ({cfg.era})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.badgeClass}`}>
                          {cfg.tag}
                        </span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div 
                        className="p-6 bg-amber-50/20 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800/80"
                        style={{ fontSize: `${1.18 + fontSizeOffset * 0.08}rem` }}
                      >
                        {tafsirObj?.available ? (
                          renderFormattedTafsirText(tafsirObj.text, inPageFilter)
                        ) : (
                          <p className="text-xs text-slate-500 italic">
                            غير متوفر بشكل منفرد لهذه الآية (مدرج ضمن سياق المقطع).
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODE 2: DEEP SEARCH HUB VIEW                                           */}
      {/* ========================================================================= */}
      {navMode === 'search' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-3xl p-6 border shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="ابحث في الآيات والتفاسير الخمسة (مثال: التقوى, الصابرين, الرزق)..."
                  value={searchInputText}
                  onChange={(e) => setSearchInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && executeSearch(true)}
                  className="w-full px-4 py-3 pl-10 rounded-2xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 font-arabic focus:outline-none focus:border-amber-500 shadow-inner"
                  autoFocus
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                {searchInputText && (
                  <button
                    onClick={() => { setSearchInputText(''); setSearchResults(null); }}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    &times;
                  </button>
                )}
              </div>

              <button
                onClick={() => executeSearch(true)}
                disabled={loadingSearch || !searchInputText.trim()}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-gold-glow transition-all disabled:opacity-50"
              >
                {loadingSearch ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>{loadingSearch ? 'Searching...' : 'Search Exegesis'}</span>
              </button>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-600 dark:text-slate-400 mr-1 flex items-center gap-1 font-semibold">
                  <Filter className="w-3.5 h-3.5" /> Scholar:
                </span>
                {[
                  { id: 'all', label: 'الكل (All)' },
                  { id: 'quran', label: 'الآيات (Quran)' },
                  { id: 'ja', label: 'الجلالين' },
                  { id: 'ik', label: 'ابن كثير' },
                  { id: 'qu', label: 'القرطبي' },
                  { id: 'sa', label: 'السعدي' },
                  { id: 'ta', label: 'الطبري' }
                ].map(chip => (
                  <button
                    key={chip.id}
                    onClick={() => { setSearchScholar(chip.id); }}
                    className={`px-3 py-1.5 rounded-xl transition-all font-bold ${
                      searchScholar === chip.id
                        ? 'bg-amber-500 text-slate-950 font-extrabold shadow'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white dark:border-slate-800'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">Scope:</span>
                <select
                  value={searchScope}
                  onChange={(e) => setSearchScope(e.target.value)}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-800 focus:outline-none cursor-pointer shadow-sm font-semibold"
                >
                  <option value="all">Whole Quran</option>
                  <option value="current_surah">Surah {currentSurahMeta.name}</option>
                  {verseData?.juz && <option value="current_juz">Juz {verseData.juz}</option>}
                </select>
              </div>
            </div>
          </div>

          {/* Search Results */}
          {loadingSearch ? (
            <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center gap-3 text-amber-600 dark:text-amber-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-sm font-bold">Searching across 43.5M words of Tafseer...</span>
            </div>
          ) : searchResults ? (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between px-2 text-xs text-slate-600 dark:text-slate-400">
                <span>
                  Found <strong className="text-amber-600 dark:text-amber-400 font-mono">{searchResults.total}</strong> results for "{searchResults.query}"
                </span>
                <span className="font-mono text-[11px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-800 shadow-sm">
                  ⚡ {searchResults.elapsed_ms} ms
                </span>
              </div>

              {searchResults.hits.length === 0 ? (
                <div className="glass-panel p-12 text-center rounded-2xl text-slate-500 space-y-2">
                  <Search className="w-8 h-8 mx-auto text-slate-400" />
                  <p>لم يتم العثور على نتائج تطابق عبارة البحث.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.hits.map(hit => (
                    <div
                      key={hit.seq_no}
                      onClick={() => openSearchResultInExplorer(hit, hit.matches?.[0]?.scholar_id)}
                      className="glass-panel rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:border-amber-500/60 transition-all cursor-pointer space-y-3 shadow-md"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-teal-100 text-teal-900 dark:bg-teal-500/20 dark:text-teal-300 font-extrabold text-xs font-mono">
                            {hit.surah_no}:{hit.ayah_no}
                          </span>
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {hit.surah_name}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            &bull; Page {hit.page_no} &bull; Juz {hit.juz}
                          </span>
                        </div>

                        <button className="px-3 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-900 dark:text-amber-300 text-xs font-bold flex items-center gap-1 border border-amber-300 dark:border-amber-500/30">
                          <span>Explore Verse</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {hit.matches?.map((m, mIdx) => (
                        <div key={mIdx} className="space-y-1 bg-amber-50/30 dark:bg-slate-950/50 p-3.5 rounded-xl border border-amber-200/60 dark:border-slate-800/60">
                          <div className="text-[11px] font-bold text-teal-700 dark:text-teal-400">
                            {m.name} ({m.englishName}):
                          </div>
                          <div 
                            className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-tafsir select-text"
                            dangerouslySetInnerHTML={{ __html: m.snippet }}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODE 3: CONSOLIDATED SURAH READER                                      */}
      {/* ========================================================================= */}
      {navMode === 'reader' && (
        <div className="space-y-4">
          {/* Reader Top Controls & Scope Filter */}
          <div className="glass-panel rounded-2xl p-4 md:p-5 border shadow-xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-extrabold text-sm md:text-base text-slate-900 dark:text-slate-100">
                  Surah {currentSurahMeta.name} ({currentSurahMeta.arabic})
                </h3>
                <span className="text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md font-mono">
                  {currentSurahMeta.totalAyahs} Verses
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Continuous recitation flow with inline exegesis (Al-Jalalayn)
              </p>
            </div>

            {/* Scope Filter Switcher (All Verses vs Selected Verse) */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-300 dark:border-slate-800 text-xs font-bold">
                <button
                  onClick={() => setReaderFilterScope('all')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    readerFilterScope === 'all'
                      ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950 shadow-sm font-extrabold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>All Verses (1–{currentSurahMeta.totalAyahs})</span>
                </button>

                <button
                  onClick={() => setReaderFilterScope('selected')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    readerFilterScope === 'selected'
                      ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950 shadow-sm font-extrabold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Only Ayah {ayahNum}</span>
                </button>
              </div>

              {/* Expand / Collapse Toggle Button */}
              <button
                onClick={() => {
                  const allIds = new Set(displayedReaderVerses.map(v => v.ayah_no));
                  setExpandedReaderAyahs(expandedReaderAyahs.size === allIds.size ? new Set() : allIds);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white shadow-sm"
              >
                {expandedReaderAyahs.size === displayedReaderVerses.length ? 'Collapse Tafseers' : 'Expand Tafseers'}
              </button>
            </div>
          </div>

          {/* Reader Verse List */}
          {loadingSurah ? (
            <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center gap-3 text-blue-600 dark:text-blue-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-sm font-bold">Loading Surah Verses...</span>
            </div>
          ) : (
            <div className="space-y-3.5">
              {displayedReaderVerses.map(v => {
                const isExpanded = expandedReaderAyahs.has(v.ayah_no);
                const isSelected = v.ayah_no === ayahNum;

                return (
                  <div
                    key={v.seq_no}
                    id={`ayah-reader-card-${v.ayah_no}`}
                    onClick={() => {
                      if (v.ayah_no !== ayahNum) setAyahNum(v.ayah_no);
                    }}
                    className={`glass-panel rounded-2xl p-5 md:p-6 transition-all space-y-3.5 cursor-pointer ${
                      isSelected
                        ? 'border-2 border-teal-500 shadow-lg ring-2 ring-teal-400/40 bg-teal-500/[0.04] dark:bg-teal-950/[0.12]'
                        : 'border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Verse Header & Audio Play Action */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-9 h-9 rounded-xl font-extrabold text-xs flex items-center justify-center font-mono shadow-sm ${
                          isSelected
                            ? 'bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950'
                            : 'bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300'
                        }`}>
                          {v.ayah_no}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playVerseAudio(v.audio_url);
                          }}
                          className="p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-300 border border-slate-200 dark:border-slate-700 shadow-sm"
                          title="Play Recitation"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </div>

                      {/* Uthmani Calligraphy Text */}
                      <div className="flex-1 font-quran text-right text-slate-900 dark:text-slate-100 text-xl md:text-2xl leading-[2.6] select-text">
                        {v.ayaat_mt}
                      </div>
                    </div>

                    {/* Quick Exegesis & Full View Action Bar */}
                    <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-xs">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextSet = new Set(expandedReaderAyahs);
                          if (nextSet.has(v.ayah_no)) nextSet.delete(v.ayah_no);
                          else nextSet.add(v.ayah_no);
                          setExpandedReaderAyahs(nextSet);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? 'Hide Exegesis' : 'Read Tafsir (Al-Jalalayn)'}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSurahNum(v.surah_no);
                          setAyahNum(v.ayah_no);
                          setNavMode('explorer');
                        }}
                        className="text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-300 flex items-center gap-1 font-bold"
                      >
                        <span>Full 5 Scholars View</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Inline Expanded Exegesis Box */}
                    {isExpanded && (
                      <div className="p-4 md:p-5 rounded-xl bg-amber-50/40 dark:bg-slate-950/60 border border-amber-200/80 dark:border-slate-800 text-xs font-tafsir leading-relaxed text-slate-800 dark:text-slate-200 space-y-1.5 shadow-inner" dir="rtl">
                        <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">تفسير الجلالين:</div>
                        <div>{v.tafsir_ja || 'غير متوفر'}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MISRI MANUSCRIPT OVERLAY MODAL (High Z-Index 100)                     */}
      {/* ========================================================================= */}
      {showManuscriptModal && verseData && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500/40 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Misri Manuscript &bull; Page {verseData.page_no}</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-mono">({verseData.surah_no}:{verseData.ayah_no})</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Surah {verseData.surah_name} &bull; Exact Madani Calligraphy
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => jumpToTilawatManuscript(verseData.page_no)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tilawat Tab</span>
                </button>

                <button
                  onClick={() => setShowManuscriptModal(false)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Manuscript Image Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 dark:bg-slate-950 custom-scrollbar">
              <div className="relative inline-block border border-gold-500/30 rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={`/api/page_image/${verseData.page_no}`}
                  alt={`Quran Page ${verseData.page_no}`}
                  onLoad={(e) => {
                    const { naturalWidth, naturalHeight } = e.target;
                    if (naturalWidth && naturalHeight) {
                      setModalDimensions({ width: naturalWidth, height: naturalHeight });
                    }
                  }}
                  className="relative z-0 pointer-events-none block max-w-full h-auto select-none"
                />

                {/* Overlaid Highlight Coordinate Box */}
                {modalBoxes
                  .filter(b => b.sura === verseData.surah_no && b.ayah === verseData.ayah_no)
                  .map((box, bIdx) => {
                    const leftPct = (box.min_x / modalDimensions.width) * 100;
                    const topPct = (box.min_y / modalDimensions.height) * 100;
                    const widthPct = ((box.max_x - box.min_x) / modalDimensions.width) * 100;
                    const heightPct = ((box.max_y - box.min_y) / modalDimensions.height) * 100;

                    return (
                      <div
                        key={`modal-box-${bIdx}`}
                        className="absolute z-10 rounded-md border-2 border-amber-400 bg-amber-500/35 shadow-gold-glow animate-pulse"
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                        }}
                      />
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
