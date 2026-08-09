import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BookOpen, Play, Pause, ChevronLeft, ChevronRight, Volume2, Info, Layers, RefreshCw, FileText, RotateCcw, Activity } from 'lucide-react';
import { getJuzPageRange, JUZ_LIST, SURAH_LIST } from '../utils/juzMapping';

export const TilawatTab = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJuz, setSelectedJuz] = useState(1);
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [mappedBoxes, setMappedBoxes] = useState([]);
  const [loadingBoxes, setLoadingBoxes] = useState(false);
  const [selectedAyah, setSelectedAyah] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioGlobalId, setAudioGlobalId] = useState(null);
  const [ayahInfo, setAyahInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [viewMode, setViewMode] = useState('manuscript'); // 'manuscript' | 'text'
  
  // Manuscript JSON Base64 state
  const [quranData, setQuranData] = useState([]);
  const [manuscriptBase64, setManuscriptBase64] = useState('');
  const [loadingJson, setLoadingJson] = useState(false);

  // Capture natural dimensions of the manuscript page image dynamically
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 1000, height: 1000 });

  // Advanced Audio Features
  const [autoNext, setAutoNext] = useState(true);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const audioRef = useRef(null);

  // Mutable refs to resolve stale closures inside HTML5 Audio onEnded callback
  const autoNextRef = useRef(autoNext);
  const isLoopingRef = useRef(isLooping);
  const playbackSpeedRef = useRef(playbackSpeed);
  const mappedBoxesRef = useRef(mappedBoxes);
  const selectedAyahRef = useRef(selectedAyah);
  const currentPageRef = useRef(currentPage);

  useEffect(() => { autoNextRef.current = autoNext; }, [autoNext]);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
  useEffect(() => { mappedBoxesRef.current = mappedBoxes; }, [mappedBoxes]);
  useEffect(() => { selectedAyahRef.current = selectedAyah; }, [selectedAyah]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // Deduplicate mappedBoxes by global_id for clean rendering in Ayah List View
  const uniqueAyahList = useMemo(() => {
    const seen = new Set();
    return mappedBoxes.filter(box => {
      if (seen.has(box.global_id)) return false;
      seen.add(box.global_id);
      return true;
    });
  }, [mappedBoxes]);

  // Fetch quran_data.json once on mount
  useEffect(() => {
    const fetchQuranJson = async () => {
      setLoadingJson(true);
      try {
        const res = await fetch('/data/quran_data.json');
        if (res.ok) {
          const data = await res.json();
          setQuranData(data);
        }
      } catch (err) {
        console.error("Failed to load /data/quran_data.json:", err);
      } finally {
        setLoadingJson(false);
      }
    };
    fetchQuranJson();
  }, []);

  // Fetch page bounding boxes when page changes
  useEffect(() => {
    fetchPageBoxes(currentPage);
    // Update Juz selector to match current page
    for (let j = 1; j <= 30; j++) {
      const range = getJuzPageRange(j);
      if (currentPage >= range.startPage && currentPage <= range.endPage) {
        setSelectedJuz(j);
        break;
      }
    }
    // Reset natural dimensions on page change to avoid initial render shifts
    setNaturalDimensions({ width: 1000, height: 1000 });
  }, [currentPage]);

  // Extract the active page image base64 from cached JSON
  useEffect(() => {
    if (quranData.length > 0) {
      const pageData = quranData.find(p => p.page_number === currentPage);
      if (pageData) {
        setManuscriptBase64(pageData.image_base64 || '');
      } else {
        setManuscriptBase64('');
      }
    }
  }, [currentPage, quranData]);

  // Image load handler to capture actual coordinates space size
  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight) {
      setNaturalDimensions({ width: naturalWidth, height: naturalHeight });
    }
  };

  // Format manuscript image source (Data URI prefix fix)
  const getFormattedImageSrc = (base64String) => {
    if (!base64String) return '';
    if (base64String.startsWith('data:image')) {
      return base64String;
    }
    return `data:image/jpeg;base64,${base64String}`;
  };

  const stopCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = "";
      audioRef.current = null;
    }
  };

  // Helper to find the next DISTINCT Ayah box on the page (bypassing multi-line duplicate boxes for the same Ayah)
  const getNextAyahBox = (currentBoxes, currentAyah) => {
    if (!currentBoxes || currentBoxes.length === 0 || !currentAyah) return null;
    
    // Find the LAST box index corresponding to the currently playing Ayah global_id
    let lastIndex = -1;
    for (let i = currentBoxes.length - 1; i >= 0; i--) {
      if (currentBoxes[i].global_id === currentAyah.global_id) {
        lastIndex = i;
        break;
      }
    }

    if (lastIndex !== -1 && lastIndex < currentBoxes.length - 1) {
      return currentBoxes[lastIndex + 1];
    }
    return null; // Indicates that the last Ayah of the current page has finished
  };

  const fetchPageBoxes = async (page) => {
    setLoadingBoxes(true);
    try {
      const res = await fetch(`/api/page_boxes/${page}`);
      if (res.ok) {
        const data = await res.json();
        const boxes = data.boxes || [];
        setMappedBoxes(boxes);
        mappedBoxesRef.current = boxes;
      } else {
        setMappedBoxes([]);
        mappedBoxesRef.current = [];
      }
    } catch (err) {
      console.error("Error fetching page boxes:", err);
      setMappedBoxes([]);
      mappedBoxesRef.current = [];
    } finally {
      setLoadingBoxes(false);
    }
  };

  const changePageAndPlay = async (targetPage, shouldAutoPlay = false) => {
    setLoadingBoxes(true);
    setCurrentPage(targetPage);
    try {
      const res = await fetch(`/api/page_boxes/${targetPage}`);
      if (res.ok) {
        const data = await res.json();
        const boxes = data.boxes || [];
        setMappedBoxes(boxes);
        mappedBoxesRef.current = boxes;
        
        if (shouldAutoPlay && boxes.length > 0) {
          const firstAyah = boxes[0];
          fetchAyahInfo(firstAyah.global_id);
          playTilawatAudio(firstAyah);
        } else if (shouldAutoPlay) {
          stopCurrentAudio();
          setIsPlayingAudio(false);
        }
      } else {
        setMappedBoxes([]);
        mappedBoxesRef.current = [];
        if (shouldAutoPlay) {
          stopCurrentAudio();
          setIsPlayingAudio(false);
        }
      }
    } catch (err) {
      console.error("Error fetching page boxes for page change:", err);
      setMappedBoxes([]);
      mappedBoxesRef.current = [];
      if (shouldAutoPlay) {
        stopCurrentAudio();
        setIsPlayingAudio(false);
      }
    } finally {
      setLoadingBoxes(false);
    }
  };

  const handleJuzSelect = (juzNum) => {
    const juz = parseInt(juzNum, 10);
    setSelectedJuz(juz);
    const range = getJuzPageRange(juz);
    changePageAndPlay(range.startPage, isPlayingAudio);
  };

  const handleSurahSelect = (surahId) => {
    const surah = SURAH_LIST.find(s => s.id === parseInt(surahId, 10));
    if (surah) {
      setSelectedSurah(surah.id);
      const startP = parseInt(surah.pages.split('-')[0], 10);
      if (!isNaN(startP)) {
        changePageAndPlay(startP, isPlayingAudio);
      }
    }
  };

  const playTilawatAudio = (boxOrGlobalId) => {
    stopCurrentAudio(); // Guarantee single audio instance playing!

    let targetBox = null;
    let globalId = null;

    if (typeof boxOrGlobalId === 'object' && boxOrGlobalId !== null) {
      targetBox = boxOrGlobalId;
      globalId = boxOrGlobalId.global_id;
    } else {
      globalId = boxOrGlobalId;
      targetBox = mappedBoxesRef.current.find(b => b.global_id === globalId) || selectedAyahRef.current;
    }

    // Synchronously update ref & React state to prevent stale closure loops
    selectedAyahRef.current = targetBox;
    if (targetBox) {
      setSelectedAyah(targetBox);
    }

    setAudioGlobalId(globalId);
    setIsPlayingAudio(true);
    
    const newAudio = new Audio(`/api/audio/${globalId}`);
    newAudio.playbackRate = playbackSpeedRef.current;
    audioRef.current = newAudio;

    newAudio.play().catch(err => {
      console.error("Audio playback error:", err);
      setIsPlayingAudio(false);
    });

    // Enforce Advanced Loop & Auto-Next Logic when Audio finishes playing (Continuous Reading)
    newAudio.onended = () => {
      setIsPlayingAudio(false);
      
      if (isLoopingRef.current) {
        // Option A: Replay active track
        playTilawatAudio(targetBox || globalId);
      } else if (autoNextRef.current) {
        const currentBoxes = mappedBoxesRef.current;
        const currentAyah = selectedAyahRef.current;
        
        // Retrieve next DISTINCT Ayah box on current page
        const nextAyah = getNextAyahBox(currentBoxes, currentAyah);
        
        if (nextAyah) {
          // Option B: Play next distinct Ayah on current page
          fetchAyahInfo(nextAyah.global_id);
          playTilawatAudio(nextAyah);
        } else if (currentPageRef.current < 604) {
          // Option C: Last Ayah of page finished -> Advance page and autoplay Ayah 1 of next page
          const nextPage = currentPageRef.current + 1;
          changePageAndPlay(nextPage, true);
        }
      }
    };
  };

  const fetchAyahInfo = async (globalId) => {
    setLoadingInfo(true);
    try {
      const res = await fetch(`/api/ayah_info/${globalId}`);
      if (res.ok) {
        const data = await res.json();
        setAyahInfo(data);
      }
    } catch (err) {
      console.error("Error fetching ayah info:", err);
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleBoxClick = (box) => {
    fetchAyahInfo(box.global_id);
    playTilawatAudio(box);
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.play().then(() => {
          setIsPlayingAudio(true);
        }).catch(err => console.error("Playback play failed:", err));
      }
    } else if (selectedAyah) {
      playTilawatAudio(selectedAyah);
    } else if (mappedBoxes.length > 0) {
      const firstAyah = mappedBoxes[0];
      fetchAyahInfo(firstAyah.global_id);
      playTilawatAudio(firstAyah);
    }
  };

  const cyclePlaybackSpeed = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls Bar - Swapped RTL Page Controls & Responsive UI */}
      <div className="glass-panel dark:glass-panel light:bg-white light:border-slate-200 rounded-2xl p-5 border shadow-xl space-y-4 transition-colors duration-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Navigation Jump Controls (RTL Swapped for Arabic Right-to-Left Reading) */}
          <div className="flex items-center gap-3">
            {/* Left Button -> Advances to NEXT Page in Arabic RTL reading */}
            <button
              onClick={() => {
                const nextPage = Math.min(604, currentPage + 1);
                changePageAndPlay(nextPage, isPlayingAudio);
              }}
              disabled={currentPage >= 604}
              title="Next Page (الصفحة التالية - RTL)"
              aria-label="Next Page"
              className="p-2.5 rounded-xl bg-slate-900 dark:bg-slate-900 light:bg-slate-100 border border-slate-700 dark:border-slate-700 light:border-slate-200 text-slate-200 dark:text-slate-200 light:text-slate-700 hover:border-gold-500/50 hover:text-gold-300 disabled:opacity-40 transition-all shadow-sm flex items-center gap-1.5"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">Next</span>
            </button>

            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 dark:bg-slate-900/90 light:bg-slate-50 border border-gold-500/30 light:border-slate-200 shadow-inner">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 light:text-slate-500">Page:</span>
              <input
                type="number"
                min={1}
                max={604}
                value={currentPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val >= 1 && val <= 604) {
                    changePageAndPlay(val, isPlayingAudio);
                  }
                }}
                className="w-16 bg-slate-950 dark:bg-slate-950 light:bg-white border border-slate-750 dark:border-slate-700 light:border-slate-200 rounded-lg px-2 py-1 text-center text-gold-300 dark:text-gold-300 light:text-slate-805 font-bold text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 light:text-slate-500">/ 604</span>
            </div>

            {/* Right Button -> Goes to PREVIOUS Page in Arabic RTL reading */}
            <button
              onClick={() => {
                const prevPage = Math.max(1, currentPage - 1);
                changePageAndPlay(prevPage, isPlayingAudio);
              }}
              disabled={currentPage <= 1}
              title="Previous Page (الصفحة السابقة - RTL)"
              aria-label="Previous Page"
              className="p-2.5 rounded-xl bg-slate-900 dark:bg-slate-900 light:bg-slate-100 border border-slate-700 dark:border-slate-700 light:border-slate-200 text-slate-200 dark:text-slate-200 light:text-slate-700 hover:border-gold-500/50 hover:text-gold-300 disabled:opacity-40 transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">Prev</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Dropdowns for Juz & Surah */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 light:text-slate-555">Juz:</span>
              <select
                value={selectedJuz}
                onChange={(e) => handleJuzSelect(e.target.value)}
                className="bg-slate-900 dark:bg-slate-900 light:bg-slate-100 text-slate-100 dark:text-slate-100 light:text-slate-850 text-xs font-semibold rounded-xl px-3 py-2 border border-slate-750 dark:border-slate-700 light:border-slate-200 focus:outline-none transition-colors"
              >
                {JUZ_LIST.map((j) => <option key={j.id} value={j.id}>{j.displayLabel}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 light:text-slate-555">Surah:</span>
              <select
                value={selectedSurah}
                onChange={(e) => handleSurahSelect(e.target.value)}
                className="bg-slate-900 dark:bg-slate-900 light:bg-slate-100 text-slate-100 dark:text-slate-100 light:text-slate-855 text-xs font-semibold rounded-xl px-3 py-2 border border-slate-750 dark:border-slate-700 light:border-slate-200 focus:outline-none max-w-[180px] transition-colors"
              >
                {SURAH_LIST.map((s) => <option key={s.id} value={s.id}>{s.id}. {s.name}</option>)}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950 dark:bg-slate-950 light:bg-slate-100 p-1 rounded-xl border border-slate-855 dark:border-slate-800 light:border-slate-200 transition-colors">
              <button
                onClick={() => setViewMode('manuscript')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === 'manuscript' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 dark:text-slate-400 light:text-slate-600'}`}
              >
                Manuscript
              </button>
              <button
                onClick={() => setViewMode('text')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${viewMode === 'text' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 dark:text-slate-400 light:text-slate-600'}`}
              >
                Ayah List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Manuscript Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Manuscript / Ayah Map */}
        <div className="lg:col-span-2 glass-panel dark:glass-panel light:bg-white light:border-slate-200 rounded-2xl p-6 border flex flex-col items-center justify-center min-h-[600px] relative transition-colors duration-200 overflow-hidden">
          {loadingBoxes || loadingJson ? (
            <div className="flex flex-col items-center justify-center gap-3 text-gold-400 py-20">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-sm font-semibold">Loading Page {currentPage}...</span>
            </div>
          ) : viewMode === 'manuscript' ? (
            /* Manuscript View - Clean Key and Relative Container */
            <div key={`manuscript-page-${currentPage}`} className="relative inline-block mx-auto max-w-xl border border-gold-500/30 dark:border-gold-500/30 light:border-slate-200 rounded-xl overflow-hidden bg-amber-50/5 shadow-2xl p-0 m-0 w-full">
              {manuscriptBase64 ? (
                <img
                  src={getFormattedImageSrc(manuscriptBase64)}
                  alt={`Madani Quran Page ${currentPage}`}
                  onLoad={handleImageLoad}
                  className="relative z-0 pointer-events-none block max-w-full h-auto p-0 m-0 mx-auto"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 min-h-[500px] w-full">
                  <BookOpen className="w-16 h-16 text-amber-500/40" />
                  <p className="text-xs text-slate-400">Manuscript Page {currentPage} not found in JSON data.</p>
                </div>
              )}

              {/* Bounding boxes */}
              {manuscriptBase64 && mappedBoxes.map((box, idx) => {
                const isSelected = selectedAyah?.global_id === box.global_id;
                
                const leftPct = (box.min_x / naturalDimensions.width) * 100;
                const topPct = (box.min_y / naturalDimensions.height) * 100;
                const widthPct = ((box.max_x - box.min_x) / naturalDimensions.width) * 100;
                const heightPct = ((box.max_y - box.min_y) / naturalDimensions.height) * 100;

                return (
                  <button
                    key={`box-${box.global_id}-${idx}`}
                    onClick={() => handleBoxClick(box)}
                    title={`Surah ${box.sura}, Ayah ${box.ayah}`}
                    className={`absolute z-10 rounded transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-500/30 border-amber-400 shadow-gold-glow ring-2 ring-amber-400/60'
                        : 'bg-amber-500/5 hover:bg-amber-500/25 border-amber-500/20 hover:border-amber-400/50'
                    }`}
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
          ) : (
            /* Ayah List View - Clean Key and Unique Ayah List */
            <div key={`ayah-list-page-${currentPage}`} className="w-full space-y-3 max-h-[600px] overflow-y-auto pr-2">
              <h3 className="text-sm font-bold text-gold-300 px-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Mapped Ayahs on Page {currentPage} ({uniqueAyahList.length})
              </h3>
              {uniqueAyahList.map((box) => (
                <div
                  key={`ayah-card-${box.global_id}`}
                  onClick={() => handleBoxClick(box)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${selectedAyah?.global_id === box.global_id ? 'bg-amber-950/40 dark:bg-amber-950/40 light:bg-slate-50 border-amber-500/60 light:border-slate-200 shadow-gold-glow text-slate-100 dark:text-slate-100 light:text-slate-900' : 'bg-slate-900/60 dark:bg-slate-900/60 light:bg-white border-slate-800 dark:border-slate-800 light:border-slate-200 text-slate-300 dark:text-slate-300 light:text-slate-700 hover:bg-slate-900 hover:border-slate-700'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-amber-500/10 text-gold-300 border border-amber-500/30 flex items-center justify-center font-bold text-xs">{box.ayah}</span>
                    <div>
                      <h4 className="font-semibold text-sm">Surah {SURAH_LIST.find(s => s.id === box.sura)?.name || box.sura}</h4>
                      <span className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-555">Ayah {box.ayah}</span>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); playTilawatAudio(box); }} className="p-2 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors shadow">
                    <Play className="w-4 h-4 fill-slate-950" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Column: Inspector & Audio Panel */}
        <div className="space-y-6">
          {/* Currently Selected Ayah Inspector */}
          <div className="glass-panel-gold dark:glass-panel-gold light:bg-white light:border-slate-200 rounded-2xl p-5 border shadow-xl space-y-4 transition-colors duration-205">
            <div className="flex items-center justify-between border-b border-slate-800 dark:border-slate-800 light:border-slate-200 pb-3">
              <h3 className="font-bold text-slate-100 dark:text-slate-100 light:text-slate-955 text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-gold-400" /> Ayah Recitation Inspector
              </h3>
              {isPlayingAudio && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 animate-pulse">
                  <Volume2 className="w-3.5 h-3.5" /> Reciting...
                </span>
              )}
            </div>

            {selectedAyah ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/90 dark:bg-slate-900/90 light:bg-slate-50 border border-slate-800 dark:border-slate-800 light:border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 dark:text-slate-400 light:text-slate-655 font-medium">Surah Number:</span>
                    <span className="font-mono text-gold-300 dark:text-gold-300 light:text-slate-900 font-bold">{selectedAyah.sura}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 dark:text-slate-400 light:text-slate-655 font-medium">Ayah Number:</span>
                    <span className="font-mono text-gold-300 dark:text-gold-300 light:text-slate-900 font-bold">{selectedAyah.ayah}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 dark:text-slate-400 light:text-slate-655 font-medium">Global Ayah ID:</span>
                    <span className="font-mono text-emerald-400 font-bold">#{selectedAyah.global_id}</span>
                  </div>
                </div>

                {loadingInfo ? (
                  <div className="text-xs text-slate-400 py-2 flex items-center justify-center gap-2"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching details...</div>
                ) : ayahInfo ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 dark:bg-amber-500/10 light:bg-amber-50 border border-amber-500/30 light:border-amber-300/60 text-amber-250 dark:text-amber-200 light:text-amber-800 text-center space-y-1">
                    <h4 className="font-arabic text-lg text-gold-300 dark:text-gold-300 light:text-amber-800 font-bold">{ayahInfo.surah_name}</h4>
                    <p className="text-xs text-slate-355 dark:text-slate-300 light:text-slate-500">Surah #{ayahInfo.surah} • Ayah #{ayahInfo.ayah}</p>
                  </div>
                ) : null}

                {/* Advanced Audio Controls Panel */}
                <div className="p-4 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-50 border border-slate-800 dark:border-slate-800 light:border-slate-200 space-y-3.5">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-400 light:text-slate-555 uppercase tracking-wider">Audio Playback Controls</div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Continuous Reading Toggle Pill */}
                    <button
                      onClick={() => setAutoNext(!autoNext)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        autoNext 
                          ? 'bg-amber-500/20 text-gold-300 border-amber-500/40 shadow-inner' 
                          : 'bg-slate-950/60 dark:bg-slate-950/60 light:bg-white text-slate-400 dark:text-slate-400 light:text-slate-500 border-slate-800 dark:border-slate-700 light:border-slate-200'
                      }`}
                      title="Automatically continue reading through next Ayahs & pages seamlessly when audio finishes"
                    >
                      <Activity className={`w-3.5 h-3.5 ${autoNext ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                      <span>{autoNext ? "Continuous Reading ON" : "Continuous Reading OFF"}</span>
                    </button>

                    {/* Loop Toggle Pill */}
                    <button
                      onClick={() => setIsLooping(!isLooping)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        isLooping 
                          ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40 shadow-inner' 
                          : 'bg-slate-950/60 dark:bg-slate-950/60 light:bg-white text-slate-400 dark:text-slate-400 light:text-slate-500 border-slate-800 dark:border-slate-700 light:border-slate-200'
                      }`}
                      title="Loop and repeat the current Ayah indefinitely"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isLooping ? 'text-emerald-400 animate-spin-slow' : 'text-slate-500'}`} />
                      <span>Loop Ayah</span>
                    </button>
                  </div>

                  {/* Playback Speed Cycler */}
                  <div className="flex items-center justify-between text-xs border-t border-slate-800 dark:border-slate-800 light:border-slate-200 pt-2.5">
                    <span className="text-slate-400 dark:text-slate-400 light:text-slate-500 font-medium">Reciter Speed:</span>
                    <button
                      onClick={cyclePlaybackSpeed}
                      className="px-3 py-1 rounded-md bg-slate-950 dark:bg-slate-950 light:bg-white text-gold-300 dark:text-gold-300 light:text-slate-805 border border-slate-850 dark:border-slate-700 light:border-slate-200 font-bold hover:border-gold-500/50 hover:text-gold-200 transition-colors shadow-sm"
                    >
                      {playbackSpeed.toFixed(2)}x
                    </button>
                  </div>
                </div>

                {/* Primary Play/Pause Controls */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={togglePlayback}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-gold-glow transition-all"
                  >
                    {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-slate-950" />}
                    <span>{isPlayingAudio ? "Pause Recitation" : "Listen Recitation Audio"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs space-y-2">
                <BookOpen className="w-8 h-8 mx-auto text-slate-600" />
                <p className="dark:text-slate-400 light:text-slate-500">Click on any Ayah bounding box or list item to hear audio recitation and view metadata.</p>
                <div className="pt-2">
                  <button
                    onClick={togglePlayback}
                    className="py-2.5 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-gold-300 font-bold text-xs border border-amber-500/30 transition-all inline-flex items-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5 fill-gold-300" /> Start Continuous Reading
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
