import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext();

export const FONT_OPTIONS = {
  ui: [
    { id: 'Inter', name: 'Inter (Academic Modern - Default)', family: "'Inter', sans-serif" },
    { id: 'Outfit', name: 'Outfit (Clean Geometric Sans)', family: "'Outfit', sans-serif" },
    { id: 'System', name: 'System Default (Native OS Sans)', family: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" },
  ],
  quran: [
    { id: 'MQTibyan', name: 'MQTibyan / Me Quran (Authentic Madani Calligraphy - Default)', family: "'MQTibyan', 'Scheherazade New', 'Amiri', serif", author: 'مصحف المدينة المنورة' },
    { id: 'FFKanz', name: 'Kanz al-Marjaan (Classical Serif Manuscript)', family: "'FFKanz', 'KMforJamea', 'Amiri', serif", author: 'كنز المرجان' },
    { id: 'KMforJamea', name: 'Al-Jamea (Traditional Academic)', family: "'KMforJamea', 'FFKanz', 'Amiri', serif", author: 'الجامعة' },
    { id: 'FFAmiri', name: 'Amiri Classical (Traditional Naskh)', family: "'FFAmiri', 'Amiri', serif", author: 'أميري الكلاسيكي' },
    { id: 'Scheherazade New', name: 'Scheherazade New (Ottoman Script)', family: "'Scheherazade New', 'Amiri', serif", author: 'شهرزاد' },
  ],
  tafsir: [
    { id: 'FFKanz', name: 'Kanz al-Marjaan (Classical Exegesis Serif - Default)', family: "'FFKanz', 'KMforJamea', 'Amiri', serif", author: 'كنز المرجان' },
    { id: 'KMforJamea', name: 'Al-Jamea (Academic Book Serif)', family: "'KMforJamea', 'FFKanz', 'Amiri', serif", author: 'الجامعة' },
    { id: 'FFAmiri', name: 'Amiri Classical (Clear Arabic Naskh)', family: "'FFAmiri', 'Amiri', serif", author: 'أميري الكلاسيكي' },
    { id: 'MQTibyan', name: 'MQTibyan (Madani Calligraphic)', family: "'MQTibyan', 'Amiri', serif", author: 'مصحف المدينة' },
  ]
};

export const DEFAULT_PORTAL_SETTINGS = {
  // Typography
  uiFont: 'Inter',
  quranFont: 'MQTibyan',
  tafsirFont: 'FFKanz',
  quranScale: 100, // 90, 100, 115, 130, 150
  tafsirScale: 100, // 90, 100, 115, 130
  lineHeight: 'standard', // 'compact', 'standard', 'relaxed'

  // Audio Engine
  defaultPlaybackSpeed: 1.0,
  autoAdvanceRecitation: true,
  defaultLoopMode: false,
  audioPreloadStrategy: 'active', // 'none', 'active', 'next'
  
  // Tafseer Defaults
  defaultTafsirScholar: 'ja',
  defaultTafsirViewMode: 'tabbed',
  readerAutoExpand: true,

  // Mutashabehat & Tasmee
  similarityThreshold: 'exact_first',
  boundingGlowStyle: 'pulse_gold',
  mistakeTolerance: 'standard',
  
  // Navigation & Startup
  defaultStartupTab: 'tilawat',
  manuscriptRenderQuality: 'hd'
};

export const AppProvider = ({ children, onSetActiveTab }) => {
  // Portal Global Settings State with LocalStorage persistence
  const [portalSettings, setPortalSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('academic_quran_settings_v2');
      if (saved) {
        return { ...DEFAULT_PORTAL_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Error reading portal settings:', e);
    }
    return DEFAULT_PORTAL_SETTINGS;
  });

  const updatePortalSettings = (update) => {
    setPortalSettings(prev => {
      const next = typeof update === 'function' ? update(prev) : { ...prev, ...update };
      try {
        localStorage.setItem('academic_quran_settings_v2', JSON.stringify(next));
      } catch (e) {
        console.warn('Error saving portal settings:', e);
      }
      return next;
    });
  };

  const resetPortalSettings = () => {
    setPortalSettings(DEFAULT_PORTAL_SETTINGS);
    try {
      localStorage.setItem('academic_quran_settings_v2', JSON.stringify(DEFAULT_PORTAL_SETTINGS));
    } catch (e) {
      console.warn('Error resetting portal settings:', e);
    }
  };

  // Sync font CSS variables to document root dynamically
  useEffect(() => {
    const root = document.documentElement;
    const uiObj = FONT_OPTIONS.ui.find(f => f.id === portalSettings.uiFont) || FONT_OPTIONS.ui[0];
    const quranObj = FONT_OPTIONS.quran.find(f => f.id === portalSettings.quranFont) || FONT_OPTIONS.quran[0];
    const tafsirObj = FONT_OPTIONS.tafsir.find(f => f.id === portalSettings.tafsirFont) || FONT_OPTIONS.tafsir[0];

    root.style.setProperty('--font-ui-family', uiObj.family);
    root.style.setProperty('--font-quran-family', quranObj.family);
    root.style.setProperty('--font-tafsir-family', tafsirObj.family);
  }, [portalSettings.uiFont, portalSettings.quranFont, portalSettings.tafsirFont]);

  // Shared global quran_data.json states
  const [quranData, setQuranData] = useState(null);
  const [loadingJson, setLoadingJson] = useState(false);

  // Model Readiness & Health States
  const [isModelReady, setIsModelReady] = useState(false);
  const [modelStatus, setModelStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [modelName, setModelName] = useState('tarteel-ai/whisper-base-ar-quran');
  const [modelError, setModelError] = useState('');

  const checkModelStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/model_status');
      if (res.ok) {
        const data = await res.json();
        const ready = Boolean(data.model_loaded);
        setIsModelReady(ready);
        setModelStatus(data.status || (ready ? 'ready' : 'loading'));
        if (data.model_name) setModelName(data.model_name);
        if (data.error) setModelError(data.error);
        return ready;
      }
    } catch (err) {
      console.warn("Failed to check model status:", err);
    }
    return false;
  }, []);

  // Poll for model readiness on initial mount until ready
  useEffect(() => {
    let interval = null;
    let isMounted = true;

    const poll = async () => {
      const ready = await checkModelStatus();
      if (ready && interval) {
        clearInterval(interval);
      }
    };

    poll();
    interval = setInterval(poll, 2000);

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [checkModelStatus]);

  const fetchQuranData = async () => {
    setLoadingJson(false);
    return [];
  };

  // Quran Simple text cache (used by MutashabehatTab)
  const [quranSimple, setQuranSimple] = useState(null);
  const [loadingSimple, setLoadingSimple] = useState(false);

  const fetchQuranSimple = useCallback(async () => {
    if (quranSimple) return;
    setLoadingSimple(true);
    try {
      const res = await fetch('/api/quran-simple');
      if (res.ok) {
        const data = await res.json();
        setQuranSimple(data);
      } else {
        console.error('Failed to fetch quran-simple:', res.status);
      }
    } catch (err) {
      console.error('fetchQuranSimple error:', err);
    } finally {
      setLoadingSimple(false);
    }
  }, [quranSimple]);

  // Cross-tab navigation — delegates to App.jsx setActiveTab via prop
  const setActiveTab = (tabId) => {
    if (onSetActiveTab) onSetActiveTab(tabId);
  };

  // 1. Tilawat Tab Persistent State
  const [tilawatState, setTilawatState] = useState({
    pageNumber: 1
  });

  // 2. Tasmee Tab Persistent State
  const [tasmeeState, setTasmeeState] = useState({
    rangeMode: 'juz',
    selectedJuz: 1,
    fromPage: 1,
    toPage: 21,
    startSurah: 112,
    endSurah: 112,
    expectedText: '',
    paginatedPages: [],
    activePageIndex: 0,
    textError: '',
    evaluationResult: null,
    elapsedSeconds: 0,
    recordedAudioUrl: '',
    recordedAudioBlob: null,
    whisperCorrections: '',
    transcriptionData: [],
    isPaused: false,
    threshold: 0.7,
    recordingTimeLimit: 120,
    showMistakes: true,
    autoScroll: true,
    pageNumber: 1,
    liveScore: 100,
    completedAyahs: 0,
    totalAyahs: 0
  });

  // 3. Ikhtebaar Tab Persistent State
  const [ikhtebaarState, setIkhtebaarState] = useState({
    rangeMode: 'juz',
    selectedJuz: 1,
    fromPage: 1,
    toPage: 21,
    startSurah: 112,
    endSurah: 112,
    difficulty: 'medium',
    currentQuestion: null,
    excludedQuestions: [],
    activeHint: null,
    gradeResult: null,
    elapsedSeconds: 0,
    recordedAudioUrl: '',
    recordedAudioBlob: null,
    whisperCorrections: '',
    transcriptionData: [],
    isPaused: false,
    examType: 'juz',
    questionCount: 5,
    questions: [],
    currentQuestionIndex: 0,
    examStarted: false,
    examFinished: false,
    examResults: null
  });

  // 4. Mutashabehat Tab Persistent State
  const [mutashabehatState, setMutashabehatState] = useState({
    searchMode: 'verse',
    keywordQuery: '',
    keywordMatchType: 'phrase',
    surahNum: 1,
    ayahNum: 1,
    targetVerse: null,
    selectedWords: new Set(),
    matches: [],
    scopeMode: 'all',
    scopeJuzs: new Set(),
    scopeSurahs: new Set(),
    pageRange: { start: 1, end: 604 },
    hasSearched: false
  });

  // 5. Tafseer Tab Persistent State
  const [tafseerState, setTafseerState] = useState({
    surahNum: 1,
    ayahNum: 1,
    activeTafsir: 'ja', // 'ja' | 'ik' | 'qu' | 'sa' | 'ta'
    viewMode: 'tabbed', // 'tabbed' | 'comparative' | 'reader'
    searchQuery: '',
    searchScholar: 'all',
    fontSizeOffset: 0,
    searchScope: 'all'
  });

  // Helper methods to modify states support functional updates
  const updateTilawat = (update) => {
    setTilawatState(prev => ({
      ...prev,
      ...(typeof update === 'function' ? update(prev) : update)
    }));
  };

  const updateTasmee = (update) => {
    setTasmeeState(prev => ({
      ...prev,
      ...(typeof update === 'function' ? update(prev) : update)
    }));
  };

  const updateIkhtebaar = (update) => {
    setIkhtebaarState(prev => ({
      ...prev,
      ...(typeof update === 'function' ? update(prev) : update)
    }));
  };

  const updateMutashabehat = (update) => {
    setMutashabehatState(prev => ({
      ...prev,
      ...(typeof update === 'function' ? update(prev) : update)
    }));
  };

  const updateTafseer = (update) => {
    setTafseerState(prev => ({
      ...prev,
      ...(typeof update === 'function' ? update(prev) : update)
    }));
  };

  // Quick navigation helper to jump directly to Tafseer for any verse from any tab
  const openTafseerForVerse = (surah, ayah, preferredTafsir = null) => {
    const s = parseInt(surah, 10) || 1;
    const a = parseInt(ayah, 10) || 1;
    setTafseerState(prev => ({
      ...prev,
      surahNum: s,
      ayahNum: a,
      activeTafsir: preferredTafsir || prev.activeTafsir || 'ja'
    }));
    setActiveTab('tafseer');
  };

  return (
    <AppContext.Provider value={{
      portalSettings,
      updatePortalSettings,
      resetPortalSettings,
      quranData,
      loadingJson,
      fetchQuranData,
      setQuranData,
      isModelReady,
      modelStatus,
      modelName,
      modelError,
      checkModelStatus,
      setActiveTab,
      quranSimple,
      loadingSimple,
      fetchQuranSimple,
      tilawatState,
      updateTilawat,
      tasmeeState,
      updateTasmee,
      ikhtebaarState,
      updateIkhtebaar,
      mutashabehatState,
      updateMutashabehat,
      tafseerState,
      updateTafseer,
      openTafseerForVerse
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
