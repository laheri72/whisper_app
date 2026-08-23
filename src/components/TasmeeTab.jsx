import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Play, CheckCircle2, AlertCircle, Eye, EyeOff, Layers, RefreshCw, FileText, Sparkles, ChevronLeft, ChevronRight, Pause, Download } from 'lucide-react';
import { getJuzPageRange, JUZ_LIST, SURAH_LIST } from '../utils/juzMapping';
import { WaveMediaRecorder } from '../utils/audioRecorder';
import { AudioVisualizer } from './AudioVisualizer';
import { useApp } from '../context/AppContext';
import { getPageFromManuscript } from '../utils/quranLookup';

export const TasmeeTab = () => {
  const { tasmeeState, updateTasmee, quranData, fetchQuranData, loadingJson } = useApp();
  const [viewMode, setViewMode] = useState('text'); // 'text' | 'manuscript'
  const {
    rangeMode,
    selectedJuz,
    fromPage,
    toPage,
    startSurah,
    endSurah,
    expectedText,
    paginatedPages,
    activePageIndex,
    textError,
    evaluationResult,
    elapsedSeconds,
    recordedAudioUrl,
    recordedAudioBlob,
    whisperCorrections,
    transcriptionData,
    isPaused
  } = tasmeeState;

  // Stateful setters mapped to context updates
  const setRangeMode = (val) => updateTasmee({ rangeMode: typeof val === 'function' ? val(rangeMode) : val });
  const setSelectedJuz = (val) => updateTasmee({ selectedJuz: typeof val === 'function' ? val(selectedJuz) : val });
  const setFromPage = (val) => updateTasmee({ fromPage: typeof val === 'function' ? val(fromPage) : val });
  const setToPage = (val) => updateTasmee({ toPage: typeof val === 'function' ? val(toPage) : val });
  const setStartSurah = (val) => updateTasmee({ startSurah: typeof val === 'function' ? val(startSurah) : val });
  const setEndSurah = (val) => updateTasmee({ endSurah: typeof val === 'function' ? val(endSurah) : val });
  const setExpectedText = (val) => updateTasmee({ expectedText: typeof val === 'function' ? val(expectedText) : val });
  const setPaginatedPages = (val) => updateTasmee({ paginatedPages: typeof val === 'function' ? val(paginatedPages) : val });
  const setActivePageIndex = (val) => updateTasmee({ activePageIndex: typeof val === 'function' ? val(activePageIndex) : val });
  const setTextError = (val) => updateTasmee({ textError: typeof val === 'function' ? val(textError) : val });
  const setEvaluationResult = (val) => updateTasmee({ evaluationResult: typeof val === 'function' ? val(evaluationResult) : val });

  // Transient UI states
  const [loadingText, setLoadingText] = useState(false);
  const [hideTargetText, setHideTargetText] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomedPageList, setZoomedPageList] = useState([]);
  const [currentZoomedIndex, setCurrentZoomedIndex] = useState(0);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizingStream, setIsFinalizingStream] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');
  const [analyserNode, setAnalyserNode] = useState(null);
  const [gradingError, setGradingError] = useState('');
  const [nudgeActive, setNudgeActive] = useState(false);
  const [nudgeText, setNudgeText] = useState('');

  const mediaRecorderRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const textContainerRef = useRef(null);
  const correctionsContainerRef = useRef(null);
  const chunkIndexRef = useRef(0);
  const sessionIdRef = useRef('');

  // Auto-scroll the real-time transcription container
  useEffect(() => {
    if (correctionsContainerRef.current) {
      correctionsContainerRef.current.scrollTop = correctionsContainerRef.current.scrollHeight;
    }
  }, [transcriptionData]);

  // Apply Juz page range calculations
  useEffect(() => {
    if (rangeMode === 'juz') {
      const range = getJuzPageRange(selectedJuz);
      updateTasmee({
        fromPage: range.startPage,
        toPage: range.endPage
      });
    }
  }, [selectedJuz, rangeMode]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    };
  }, []);

  // Handle Keyboard Navigation inside Zoom Modal (RTL logic)
  useEffect(() => {
    if (!isZoomed || zoomedPageList.length === 0) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsZoomed(false);
      } else if (e.key === 'ArrowLeft') {
        if (currentZoomedIndex < zoomedPageList.length - 1) {
          setCurrentZoomedIndex(prev => Math.min(zoomedPageList.length - 1, prev + 1));
        }
      } else if (e.key === 'ArrowRight') {
        if (currentZoomedIndex > 0) {
          setCurrentZoomedIndex(prev => Math.max(0, prev - 1));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isZoomed, currentZoomedIndex, zoomedPageList]);


  // Reset scroll on reference box changes
  useEffect(() => {
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = 0;
    }
  }, [activePageIndex, expectedText]);

  // Fetch Reference Text
  const fetchTasmeeTarget = async () => {
    setLoadingText(true);
    setTextError('');
    setEvaluationResult(null);
    setGradingError('');
    setNudgeActive(false);
    setNudgeText('');
    updateTasmee({
      activePageIndex: 0,
      whisperCorrections: '',
      transcriptionData: [],
      recordedAudioUrl: '',
      recordedAudioBlob: null
    });

    let modeParam = 'page';
    let startVal = fromPage;
    let endVal = toPage;

    if (rangeMode === 'juz') {
      const range = getJuzPageRange(selectedJuz);
      modeParam = 'page';
      startVal = range.startPage;
      endVal = range.endPage;
    } else if (rangeMode === 'page') {
      modeParam = 'page';
      startVal = fromPage;
      endVal = toPage;
    } else if (rangeMode === 'surah') {
      modeParam = 'surah';
      startVal = startSurah;
      endVal = endSurah;
    }

    try {
      const res = await fetch(`/api/tasmee_target?mode=${modeParam}&start_val=${startVal}&end_val=${endVal}`);
      const data = await res.json();

      if (data.error) {
        setTextError(data.error);
        setExpectedText('');
        setPaginatedPages([]);
      } else {
        updateTasmee({
          expectedText: data.expected_text || '',
          paginatedPages: data.pages || []
        });
      }
    } catch (err) {
      console.error(err);
      setTextError("Failed to connect to backend server.");
    } finally {
      setLoadingText(false);
    }
  };

  // 1. INITIATE RECITATION (Stateful Live Session Streaming Mode)
  const initiateRecitation = async () => {
    if (!expectedText) {
      alert("Please fetch target recitation text before initiating audio recording.");
      return;
    }

    try {
      setIsStartingRecording(true);

      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }

      setGradingError('');
      setNudgeActive(false);
      setNudgeText('');

      updateTasmee({
        recordedAudioUrl: '',
        recordedAudioBlob: null,
        whisperCorrections: '',
        transcriptionData: [],
        isPaused: false,
        evaluationResult: null,
        elapsedSeconds: 0
      });

      const sessId = 'sess_tasmee_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      sessionIdRef.current = sessId;
      chunkIndexRef.current = 0;

      // Start server-side stateful session
      const startFormData = new FormData();
      startFormData.append('session_id', sessId);
      startFormData.append('expected_text', expectedText);
      await fetch('/api/tasmee/start_session', {
        method: 'POST',
        body: startFormData
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });

      const recorder = new WaveMediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      // Incremental live chunk handler (every 4 seconds)
      recorder.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;

        const formData = new FormData();
        formData.append('file', e.data, `chunk_${chunkIndexRef.current}.wav`);
        formData.append('session_id', sessionIdRef.current);

        chunkIndexRef.current += 1;

        try {
          const res = await fetch('/api/tasmee/chunk', {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            console.log("Tasmee Live Chunk Response:", data);

            if (data.word_status) {
              updateTasmee({
                transcriptionData: data.word_status
              });
            }

            if (data.nudge) {
              setNudgeActive(true);
              setNudgeText("Take a moment — recite the upcoming word carefully...");
            } else {
              setNudgeActive(false);
            }
          }
        } catch (err) {
          console.warn("Live chunk grading failed:", err);
        }
      };

      // Wrap up session instantly on recorder stop
      recorder.onstop = async (finalBlob) => {
        setIsFinalizingStream(false);
        setIsAnalyzing(true);
        setAnalysisProgress(50);
        setAnalysisStage("Finalizing Recitation Grade Assessment...");

        const finalUrl = URL.createObjectURL(finalBlob);
        updateTasmee({
          recordedAudioBlob: finalBlob,
          recordedAudioUrl: finalUrl
        });

        try {
          const formData = new FormData();
          formData.append('session_id', sessionIdRef.current);

          const response = await fetch('/api/tasmee/conclude_session', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Server returned HTTP status ${response.status}`);
          }

          const resultData = await response.json();
          setAnalysisProgress(100);
          setAnalysisStage("Recitation Assessment Complete!");
          await new Promise(r => setTimeout(r, 200));
          setEvaluationResult(resultData);

        } catch (err) {
          console.error("Evaluation error:", err);
          setGradingError("Failed to grade recitation: " + err.message);
        } finally {
          setIsAnalyzing(false);
          setAnalyserNode(null);
          setAnalysisProgress(0);
          setAnalysisStage('');
        }
      };

      // Start recorder with 4-second chunking
      recorder.start(4000);
      setAnalyserNode(recorder.getAnalyser());
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          updateTasmee(prev => ({ elapsedSeconds: prev.elapsedSeconds + 1 }));
        }
      }, 1000);

    } catch (err) {
      alert(err.message || "Failed to start microphone recording.");
    } finally {
      setIsStartingRecording(false);
    }
  };

  // 2. PAUSE RECITATION
  const pauseRecitation = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      updateTasmee({ isPaused: true });
    }
  };

  // 3. RESUME RECITATION
  const resumeRecitation = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      updateTasmee({ isPaused: false });
    }
  };

  // 4. CONCLUDE RECITATION & FLUSH CHUNKS
  const concludeRecitation = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    try {
      setIsRecording(false);
      setIsFinalizingStream(true);
      setAnalysisStage("Flushing audio recording buffer...");
      
      // Stop the recorder, triggering the onstop callback with merged audio bytes
      mediaRecorderRef.current.stop();

    } catch (err) {
      console.error(err);
      alert("Failed to wrap up recitation: " + err.message);
      setIsAnalyzing(false);
      setIsFinalizingStream(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const matchCount = evaluationResult?.comparison?.filter(c => c.status === 'match').length || 0;
  const mistakeCount = evaluationResult?.comparison?.filter(c => c.status === 'mistake').length || 0;
  const totalWords = evaluationResult?.comparison?.length || 0;
  const currentDisplayPage = paginatedPages.length > 0 ? paginatedPages[activePageIndex] : null;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Range Configuration Card */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-gold-400" /> Select Recitation Range
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose Juz Module or custom page/surah parameters for memorization testing
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setRangeMode('juz')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                rangeMode === 'juz' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Juz Module (1-30)
            </button>
            <button
              onClick={() => setRangeMode('page')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                rangeMode === 'page' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Page Range
            </button>
            <button
              onClick={() => setRangeMode('surah')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                rangeMode === 'surah' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Surah Range
            </button>
          </div>
        </div>

        {/* Dynamic Inputs based on mode */}
        <div className="flex flex-wrap items-center gap-6">
          {rangeMode === 'juz' && (
            <div className="flex items-center gap-4 flex-1 min-w-[280px]">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Select Juz Module (1 to 30):
                </label>
                <select
                  value={selectedJuz}
                  onChange={(e) => setSelectedJuz(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 text-gold-300 font-bold text-sm rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-amber-500"
                >
                  {JUZ_LIST.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.displayLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-gold-500/30 text-center">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Calculated Range</span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  Page {fromPage} → {toPage}
                </span>
              </div>
            </div>
          )}

          {rangeMode === 'page' && (
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">From Page:</label>
                <input
                  type="number"
                  min={1}
                  max={604}
                  value={fromPage}
                  onChange={(e) => setFromPage(parseInt(e.target.value, 10))}
                  className="w-28 bg-slate-900 text-gold-300 font-bold text-sm rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">To Page:</label>
                <input
                  type="number"
                  min={1}
                  max={604}
                  value={toPage}
                  onChange={(e) => setToPage(parseInt(e.target.value, 10))}
                  className="w-28 bg-slate-900 text-gold-300 font-bold text-sm rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {rangeMode === 'surah' && (
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Start Surah:</label>
                <select
                  value={startSurah}
                  onChange={(e) => setStartSurah(parseInt(e.target.value, 10))}
                  className="bg-slate-900 text-slate-100 text-xs font-semibold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                >
                  {SURAH_LIST.map((s) => (
                    <option key={s.id} value={s.id}>{s.id}. {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">End Surah:</label>
                <select
                  value={endSurah}
                  onChange={(e) => setEndSurah(parseInt(e.target.value, 10))}
                  className="bg-slate-900 text-slate-100 text-xs font-semibold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                >
                  {SURAH_LIST.map((s) => (
                    <option key={s.id} value={s.id}>{s.id}. {s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Fetch Target Text Button */}
          <button
            onClick={fetchTasmeeTarget}
            disabled={loadingText}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-gold-glow transition-all disabled:opacity-50 ml-auto"
          >
            {loadingText ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span>Fetch Reference Text</span>
          </button>
        </div>
      </div>

      {/* 2. Target Text & Audio Recording Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Card: Reference Text Container */}
        <div className="glass-panel rounded-2xl p-6 border border-gold-500/20 shadow-xl space-y-4 transition-all duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-gold-400" /> Target Quran Text
            </h3>

            <div className="flex items-center gap-2">
              {/* Text Mode vs Manuscript Mode Selector */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] uppercase font-bold">
                <button
                  onClick={() => setViewMode('text')}
                  className={`px-2.5 py-1 rounded transition-all ${
                    viewMode === 'text' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Text
                </button>
                <button
                  onClick={async () => {
                    setViewMode('manuscript');
                    if (!quranData) {
                      await fetchQuranData();
                    }
                  }}
                  className={`px-2.5 py-1 rounded transition-all ${
                    viewMode === 'manuscript' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Manuscript
                </button>
              </div>

              {paginatedPages.length > 1 && !hideTargetText && viewMode === 'text' && (
                <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setActivePageIndex(prev => Math.max(0, prev - 1))}
                    disabled={activePageIndex <= 0}
                    className="p-1 hover:text-gold-300 disabled:opacity-30 transition-all"
                    title="Previous Reference Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <select
                    value={activePageIndex}
                    onChange={(e) => setActivePageIndex(parseInt(e.target.value, 10))}
                    className="bg-transparent text-amber-300 font-bold text-xs focus:outline-none px-1"
                  >
                    {paginatedPages.map((pg, idx) => (
                      <option key={idx} value={idx} className="bg-slate-950 text-slate-200">
                        {pg.label || `Page ${idx + 1}`} ({idx + 1}/{paginatedPages.length})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setActivePageIndex(prev => Math.min(paginatedPages.length - 1, prev + 1))}
                    disabled={activePageIndex >= paginatedPages.length - 1}
                    className="p-1 hover:text-gold-300 disabled:opacity-30 transition-all"
                    title="Next Reference Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {expectedText && (
                <button
                  onClick={() => setHideTargetText(!hideTargetText)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 text-xs font-semibold text-slate-300 border border-slate-700 hover:border-gold-500/40 transition-all"
                >
                  {hideTargetText ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-amber-400" /> Reveal Text
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" /> Hide (Memory Test)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Reference Text Display */}
          <div
            ref={textContainerRef}
            className={`transition-all duration-300 rounded-xl bg-slate-950/80 border border-slate-800 p-4 ${
              hideTargetText ? 'h-[85px] flex items-center justify-between border-amber-500/40 bg-amber-950/20' : 'h-[280px] overflow-y-auto block'
            }`}
          >
            {loadingText || (viewMode === 'manuscript' && loadingJson) ? (
              <div className="flex items-center justify-center h-full gap-2 text-gold-400 text-xs font-semibold animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" /> {viewMode === 'manuscript' ? 'Loading manuscript pages...' : 'Fetching target text from database...'}
              </div>
            ) : textError ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-red-400 text-xs font-semibold space-y-1">
                <AlertCircle className="w-6 h-6 mx-auto" />
                <p>{textError}</p>
              </div>
            ) : hideTargetText ? (
              <div className="flex items-center justify-between w-full px-2 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <EyeOff className="w-4 h-4 text-amber-400" />
                  <span>Reference Text Hidden — Reciting from Memory</span>
                </div>
                <button
                  onClick={() => setHideTargetText(false)}
                  className="px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-gold-300 text-[11px] font-bold border border-amber-500/30 transition-all"
                >
                  Peek Text
                </button>
              </div>
            ) : viewMode === 'manuscript' ? (() => {
              const pageRangeList = [];
              if (rangeMode === 'page' || rangeMode === 'juz') {
                for (let p = fromPage; p <= toPage; p++) {
                  pageRangeList.push(p);
                }
              } else {
                if (paginatedPages && paginatedPages.length > 0) {
                  paginatedPages.forEach((pg, idx) => {
                    const parsedNum = Number(pg.page || pg.page_number);
                    if (!isNaN(parsedNum) && parsedNum > 0) {
                      pageRangeList.push(parsedNum);
                    } else {
                      pageRangeList.push(idx + 1);
                    }
                  });
                } else {
                  pageRangeList.push(1);
                }
              }
              return (
                <div className="space-y-6 select-none" dir="rtl">
                  {pageRangeList.map(pageNum => {
                    const pageData = getPageFromManuscript(quranData, pageNum);
                    const imgUrl = pageData?.image_base64 || pageData?.misri_quran || "";
                    return (
                      <div key={pageNum} className="space-y-2 border-b border-slate-900 pb-6 last:border-0">
                        <span className="block text-xs font-semibold text-slate-400 font-mono text-center">
                          Manuscript Page {pageNum}
                        </span>
                        <div className="flex justify-center p-2 bg-slate-950 rounded-xl border border-slate-900 min-h-[200px]">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={`Misri Quran Page ${pageNum}`}
                              onClick={() => {
                                setZoomedPageList(pageRangeList);
                                const idx = pageRangeList.indexOf(pageNum);
                                setCurrentZoomedIndex(idx >= 0 ? idx : 0);
                                setIsZoomed(true);
                              }}
                              className="max-h-[300px] object-contain rounded border border-slate-800 animate-fadeIn cursor-pointer transition-all hover:scale-[1.02] hover:border-gold-500/40 shadow-md"
                              title="Click to enlarge manuscript page"
                            />
                          ) : (
                            <span className="text-slate-600 text-xs py-8">
                              Manuscript page not found in quran_data.json
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })() : expectedText ? (
              <div
                dir="rtl"
                className="w-full text-justify leading-[2.2] font-arabic text-2xl text-amber-100"
                style={{ textAlign: 'justify', textJustify: 'inter-word' }}
              >
                {currentDisplayPage ? currentDisplayPage.text : expectedText}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 text-xs space-y-1">
                <p>Click "Fetch Reference Text" above to load the expected Quran passage for recitation.</p>
              </div>
            )}
          </div>

          {expectedText && !hideTargetText && (
            <div className="text-xs text-slate-400 flex items-center justify-between px-1 border-t border-slate-900 pt-2">
              <span>
                Total Passage: <strong className="text-gold-300">{expectedText.split(' ').length}</strong> words
                {paginatedPages.length > 1 && ` • ${paginatedPages.length} Pages`}
              </span>
              <span className="text-emerald-400 font-medium">Ready for Batch Recitation</span>
            </div>
          )}
        </div>

        {/* Right Card: Audio Controls & Live Grading Visualizer */}
        <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl flex flex-col justify-between space-y-5 lg:sticky lg:top-6 self-start">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-gold-400" /> Recitation Buffer Recorder
              </h3>
              {isStartingRecording ? (
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800 animate-pulse flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" /> Activating Mic...
                </span>
              ) : isRecording ? (
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                  isPaused 
                    ? 'text-yellow-400 bg-yellow-950/40 border-yellow-800' 
                    : 'text-red-400 bg-red-950 border-red-800 animate-pulse'
                }`}>
                  {isPaused ? "PAUSED" : "REC"}: {formatTime(elapsedSeconds)}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Click <strong>"Initiate Recitation"</strong> to start. Chunks are dynamically sent to the Whisper AI model every 10 seconds. Click <strong>"Conclude Recitation"</strong> once finished.
            </p>
          </div>

          {/* Live Audio Visualizer */}
          <AudioVisualizer analyser={analyserNode} isRecording={isRecording && !isPaused} className="h-28" />

          {/* Actions & Real-Time corrections panel */}
          <div className="space-y-3">
            {isStartingRecording ? (
              <div className="py-4 rounded-xl bg-slate-900 border border-amber-500/40 text-center text-amber-300 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Activating Microphone & Audio Graph...</span>
              </div>
            ) : isFinalizingStream ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 text-center space-y-2 animate-pulse">
                <div className="flex items-center justify-center gap-2 text-amber-300 text-xs font-bold">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Merging Audio Chunks & Finalizing Stream...</span>
                </div>
              </div>
            ) : isAnalyzing ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-gold-500/40 shadow-gold-glow space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gold-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" /> AI Grading System
                  </span>
                  <span className="font-mono text-amber-400 font-extrabold">{analysisProgress}%</span>
                </div>

                <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300 shadow-gold-glow"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>

                <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                  <span className="animate-pulse text-slate-300 font-semibold">{analysisStage}</span>
                  <span className="text-amber-400/80 font-mono text-[10px]">Academic Engine</span>
                </div>
              </div>
            ) : !isRecording ? (
              <div className="space-y-3">
                <button
                  onClick={initiateRecitation}
                  disabled={!expectedText}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40"
                >
                  <Mic className="w-5 h-5" />
                  <span>Initiate Recitation</span>
                </button>

                {/* HTML5 Player & Download controls */}
                {recordedAudioUrl && (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 animate-fadeIn">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Play Back Recorded Session:</span>
                    <audio src={recordedAudioUrl} controls className="w-full" />
                    
                    <a
                      href={recordedAudioUrl}
                      download="tasmee_recitation.wav"
                      className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-gold-500/40 text-gold-300 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      <Download className="w-4 h-4" /> Save Recording
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pause/Resume Switch controls */}
                <div className="flex gap-2">
                  {isPaused ? (
                    <button
                      onClick={resumeRecitation}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <Play className="w-4 h-4" /> Resume Stream
                    </button>
                  ) : (
                    <button
                      onClick={pauseRecitation}
                      className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-amber-400 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <Pause className="w-4 h-4" /> Pause Stream
                    </button>
                  )}
                </div>

                <button
                  onClick={concludeRecitation}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 transition-all"
                >
                  <MicOff className="w-5 h-5" />
                  <span>Conclude Recitation & Grade</span>
                </button>
              </div>
            )}

            {/* Non-blocking inline grading error indicator */}
            {gradingError && (
              <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{gradingError}</span>
              </div>
            )}

            {/* Live Muhaffiz Gentle Nudge Banner */}
            {nudgeActive && (
              <div className="p-3 rounded-xl bg-amber-950/90 border border-amber-500/60 text-amber-300 text-xs font-bold flex items-center justify-between shadow-gold-glow animate-pulse">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" />
                  <span>{nudgeText || "Take a moment — recite the upcoming word carefully..."}</span>
                </div>
                <span className="text-[10px] uppercase bg-amber-900 text-amber-200 px-2.5 py-0.5 rounded-md border border-amber-600 font-extrabold tracking-wider">Muhaffiz Hint</span>
              </div>
            )}

            {/* Real-time transcription dynamic panel with scroll control and conditional word styling */}
            <div className="p-4 rounded-xl bg-slate-950/85 border border-slate-800 space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Live Recitation Progress (Stateful Mukhtabir Engine):</span>
              <div 
                ref={correctionsContainerRef}
                className="max-h-[160px] min-h-[60px] overflow-y-auto pr-1 flex flex-wrap flex-row-reverse justify-start items-center gap-2 text-right leading-relaxed font-arabic text-2xl"
                dir="rtl"
              >
                {transcriptionData && transcriptionData.length > 0 ? (
                  transcriptionData.map((item, idx) => {
                    if (item.isRawString) {
                      return (
                        <span key={idx} className="text-amber-200/90 font-medium">
                          {item.text}
                        </span>
                      );
                    }
                    const isCorrect = item.status === 'match' || item.status === 'correct' || item.correct === true || item.status === 'equal';
                    const isSkipped = item.status === 'bismillah_skipped';
                    const isPending = item.status === 'pending';
                    const isMistake = item.status === 'mistake' || item.status === 'incorrect';
                    const wordText = item.word || item.text || (typeof item === 'string' ? item : JSON.stringify(item));
                    
                    let styleClass = "text-slate-500 opacity-60";
                    if (isCorrect) {
                      styleClass = "text-emerald-400 font-bold transition-all scale-105";
                    } else if (isSkipped) {
                      styleClass = "text-slate-400 italic text-xl border-b border-slate-700/50";
                    } else if (isMistake) {
                      styleClass = "text-red-400 line-through decoration-red-600/80 decoration-2 font-bold opacity-80";
                    }

                    return (
                      <span
                        key={idx}
                        className={styleClass}
                        title={isSkipped ? "Bismillah skipped (optional opening)" : ""}
                      >
                        {wordText}
                      </span>
                    );
                  })
                ) : (
                  <div className="w-full text-center text-slate-600 font-mono text-sm tracking-widest py-2">
                    - - - - - - - -
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Academic Evaluation & Grade Report Card */}
      {evaluationResult && (
        <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/40 shadow-2xl space-y-6 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-extrabold text-2xl flex items-center justify-center shadow-gold-glow">
                {evaluationResult.score}%
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-100">Recitation Assessment Score</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    evaluationResult.score >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {evaluationResult.score >= 90 ? 'Excellent Recitation' : evaluationResult.score >= 75 ? 'Good Recitation' : 'Needs Practice'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Audio recitation transcribed and verified against Uthmani text standard.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Total Words</span>
                <span className="text-sm font-bold text-slate-100">{totalWords}</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-center">
                <span className="block text-[10px] text-emerald-400 font-semibold uppercase">Matches</span>
                <span className="text-sm font-bold text-emerald-300">{matchCount}</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-red-950/60 border border-red-500/30 text-center">
                <span className="block text-[10px] text-red-400 font-semibold uppercase">Mistakes</span>
                <span className="text-sm font-bold text-red-300">{mistakeCount}</span>
              </div>
            </div>
          </div>

          {evaluationResult.user_transcription && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recognized Recitation Output:</span>
              <p dir="rtl" className="font-arabic text-lg text-amber-200 text-right">{evaluationResult.user_transcription}</p>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Word-by-Word Analysis (Green = Match, Red = Mistake)</span>
              <span className="text-gold-400 font-arabic text-sm">التدقيق الحرفي</span>
            </h4>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap flex-row-reverse gap-3 text-right leading-loose font-arabic text-2xl">
              {evaluationResult.comparison?.map((item, idx) => {
                const isMatch = item.status === 'match';
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-xl font-bold transition-all shadow-sm ${
                      isMatch
                        ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
                        : 'bg-red-950/70 border-red-500/50 text-red-300 hover:border-red-400 ring-1 ring-red-500/30 animate-pulse'
                    }`}
                  >
                    {item.word}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {isZoomed && zoomedPageList.length > 0 && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fadeIn cursor-zoom-out"
          onClick={() => setIsZoomed(false)}
        >
          {/* Previous Page Navigation */}
          {currentZoomedIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentZoomedIndex(prev => Math.max(0, prev - 1));
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-50 text-white hover:text-amber-400 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/50 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next Page Navigation */}
          {currentZoomedIndex < zoomedPageList.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentZoomedIndex(prev => Math.min(zoomedPageList.length - 1, prev + 1));
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-50 text-white hover:text-amber-400 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/50 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <div className="relative max-w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 z-50 text-white hover:text-red-400 font-extrabold text-lg bg-black/60 hover:bg-black/85 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all"
              title="Close Enlarged View"
            >
              ✕
            </button>
            
            {(() => {
              const pageNum = zoomedPageList[currentZoomedIndex];
              const pageData = getPageFromManuscript(quranData, pageNum);
              const imgUrl = pageData?.image_base64 || pageData?.misri_quran || "";
              return (
                <div className="flex flex-col items-center space-y-2 select-none">
                  <span className="text-slate-300 font-bold font-mono text-xs bg-slate-950/80 border border-slate-800 px-3 py-1 rounded-full">
                    Page {pageNum} ({currentZoomedIndex + 1} of {zoomedPageList.length})
                  </span>
                  <img
                    src={imgUrl}
                    alt={`Enlarged Quran Page ${pageNum}`}
                    className="max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-800 cursor-default animate-scaleIn"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
