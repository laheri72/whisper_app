import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  Mic, MicOff, Play, CheckCircle2, AlertCircle, Eye, EyeOff, Layers, 
  RefreshCw, FileText, Sparkles, ChevronLeft, ChevronRight, Pause, 
  Download, X, Trash2, Volume2, RotateCcw, ZoomIn, ZoomOut, ExternalLink, Sparkle
} from 'lucide-react';
import { getJuzPageRange, JUZ_LIST, SURAH_LIST, FULL_SURAH_LIST } from '../utils/juzMapping';
import { WaveMediaRecorder } from '../utils/audioRecorder';
import { AudioVisualizer } from './AudioVisualizer';
import { useApp } from '../context/AppContext';

export const TasmeeTab = () => {
  const { 
    tasmeeState, updateTasmee, quranData, fetchQuranData, 
    loadingJson, isModelReady, modelStatus, modelError,
    setActiveTab = () => {}, updateTilawat = () => {}
  } = useApp();

  const [viewMode, setViewMode] = useState('text'); // 'text' | 'manuscript'
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioPlayerRef = useRef(null);

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

  // Manuscript Lightbox Modal State with Bounding Box Highlights
  const [modalTarget, setModalTarget] = useState(null); // { page, label, specificAyah }
  const [modalBoxes, setModalBoxes] = useState([]);
  const [loadingModalBoxes, setLoadingModalBoxes] = useState(false);
  const [modalDimensions, setModalDimensions] = useState({ width: 1000, height: 1000 });
  const [modalZoom, setModalZoom] = useState(1);
  const [zoomedPageList, setZoomedPageList] = useState([]);
  const [currentZoomedIndex, setCurrentZoomedIndex] = useState(0);

  const mediaRecorderRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);
  const textContainerRef = useRef(null);
  const correctionsContainerRef = useRef(null);
  const assessmentCardRef = useRef(null);
  const chunkIndexRef = useRef(0);
  const sessionIdRef = useRef('');

  // Auto-scroll the real-time transcription container
  useEffect(() => {
    if (correctionsContainerRef.current) {
      correctionsContainerRef.current.scrollTop = correctionsContainerRef.current.scrollHeight;
    }
  }, [transcriptionData]);

  // Auto-scroll to top Assessment Score card when evaluation finishes
  useEffect(() => {
    if (evaluationResult && assessmentCardRef.current) {
      assessmentCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [evaluationResult]);

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

  // Clean up timer and media stream on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current) mediaRecorderRef.current.abort();
    };
  }, []);

  // Fetch page bounding boxes when modal target page changes
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

  // Handle Keyboard Navigation inside Zoom Modal (RTL logic)
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

  // Reset scroll on reference box changes
  useEffect(() => {
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = 0;
    }
  }, [activePageIndex, expectedText]);

  // Open Manuscript Lightbox Modal
  const handleOpenManuscriptModal = (targetPage = null, specificAyah = null) => {
    // Resolve current active page properly
    let defaultPg = 1;
    if (paginatedPages && paginatedPages.length > 0) {
      defaultPg = Number(paginatedPages[activePageIndex]?.page_number || paginatedPages[0]?.page_number || 1);
    } else if (rangeMode === 'surah') {
      const sStart = FULL_SURAH_LIST.find((s) => s.id === Number(startSurah));
      defaultPg = sStart?.startPage || 1;
    } else {
      defaultPg = Number(fromPage) || 1;
    }

    const pageNum = targetPage !== null ? Number(targetPage) : Number(defaultPg);

    // Compute page range list for navigation in modal
    const pageRangeList = [];
    if (rangeMode === 'page' || rangeMode === 'juz') {
      const minP = Math.min(Number(fromPage) || 1, Number(toPage) || 1);
      const maxP = Math.max(Number(fromPage) || 1, Number(toPage) || 1);
      for (let p = minP; p <= maxP; p++) pageRangeList.push(p);
    } else if (paginatedPages && paginatedPages.length > 0) {
      paginatedPages.forEach((pg, i) => {
        const pNum = Number(pg.page_number || pg.page);
        pageRangeList.push(!isNaN(pNum) && pNum > 0 ? pNum : i + 1);
      });
    } else if (rangeMode === 'surah') {
      const sStart = FULL_SURAH_LIST.find((s) => s.id === Number(startSurah));
      const sEnd = FULL_SURAH_LIST.find((s) => s.id === Number(endSurah)) || sStart;
      const minP = sStart?.startPage || 1;
      const maxP = sEnd?.endPage || sStart?.endPage || minP;
      for (let p = minP; p <= maxP; p++) pageRangeList.push(p);
    } else {
      pageRangeList.push(pageNum);
    }

    const uniquePages = Array.from(new Set(pageRangeList)).sort((a, b) => a - b);
    setZoomedPageList(uniquePages);
    const idx = uniquePages.indexOf(pageNum);
    setCurrentZoomedIndex(idx >= 0 ? idx : 0);

    setModalTarget({
      page: pageNum,
      label: `Page ${pageNum}`,
      specificAyah: specificAyah
    });
    setModalZoom(1);
  };

  const handleModalPageChange = (newPage) => {
    const idx = zoomedPageList.indexOf(newPage);
    if (idx >= 0) setCurrentZoomedIndex(idx);
    setModalTarget((prev) => ({
      ...prev,
      page: newPage,
      label: `Page ${newPage}`,
      specificAyah: null
    }));
  };

  const handleJumpToTilawat = (pageNum) => {
    updateTilawat({
      pageNumber: Number(pageNum)
    });
    setActiveTab('tilawat');
  };

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
      setTextError('Failed to connect to backend server.');
    } finally {
      setLoadingText(false);
    }
  };

  // 1. INITIATE RECITATION (Stateful Live Session Streaming Mode)
  const initiateRecitation = async () => {
    if (!expectedText) {
      alert('Please fetch target recitation text before initiating audio recording.');
      return;
    }

    if (!isModelReady) {
      alert('Whisper AI Quran model is currently loading weights into memory. Please wait a moment until the status indicator turns green.');
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
      abortControllerRef.current = new AbortController();

      // Start server-side stateful session
      const startFormData = new FormData();
      startFormData.append('session_id', sessId);
      startFormData.append('expected_text', expectedText);
      startFormData.append('range_mode', rangeMode);
      startFormData.append('start_val', rangeMode === 'surah' ? startSurah : rangeMode === 'page' ? fromPage : selectedJuz);
      startFormData.append('end_val', rangeMode === 'surah' ? endSurah : rangeMode === 'page' ? toPage : selectedJuz);
      const startRes = await fetch('/api/tasmee/start_session', {
        method: 'POST',
        body: startFormData,
        signal: abortControllerRef.current.signal
      });
      if (startRes.ok) {
        const startData = await startRes.json();
        if (startData.word_status) {
          updateTasmee({
            transcriptionData: startData.word_status
          });
        }
      }

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

      // Incremental live chunk handler (every 6 seconds)
      recorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return Promise.resolve();

        const formData = new FormData();
        formData.append('file', e.data, `chunk_${chunkIndexRef.current}.wav`);
        formData.append('session_id', sessionIdRef.current);

        chunkIndexRef.current += 1;

        return fetch('/api/tasmee/chunk', {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current?.signal
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data.word_status) {
              updateTasmee({
                transcriptionData: data.word_status
              });
            }

            if (data.nudge) {
              setNudgeActive(true);
              setNudgeText('Take a moment — recite the upcoming word carefully...');
            } else {
              setNudgeActive(false);
            }
          }
        }).catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('Live chunk grading failed:', err);
          }
        });
      };

      // Wrap up session instantly on recorder stop
      recorder.onstop = async (finalBlob) => {
        setIsFinalizingStream(false);
        setIsAnalyzing(true);
        setAnalysisProgress(50);
        setAnalysisStage('Finalizing Recitation Grade Assessment...');

        const finalUrl = URL.createObjectURL(finalBlob);
        updateTasmee({
          recordedAudioBlob: finalBlob,
          recordedAudioUrl: finalUrl
        });

        try {
          const concludeFormData = new FormData();
          concludeFormData.append('session_id', sessionIdRef.current);
          concludeFormData.append('file', finalBlob, 'complete_recitation.wav');

          const concludeRes = await fetch('/api/tasmee/conclude_session', {
            method: 'POST',
            body: concludeFormData
          });

          if (concludeRes.ok) {
            const gradeData = await concludeRes.json();
            setAnalysisProgress(100);
            updateTasmee({
              evaluationResult: gradeData
            });
          } else {
            const errData = await concludeRes.json();
            setGradingError(errData.detail || 'Failed to calculate recitation score.');
          }
        } catch (err) {
          console.error(err);
          setGradingError('Network error during assessment finalize.');
        } finally {
          setIsAnalyzing(false);
        }
      };

      recorder.start(6000);
      setAnalyserNode(recorder.getAnalyser());
      setIsStartingRecording(false);
      setIsRecording(true);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        updateTasmee((prev) => ({ elapsedSeconds: prev.elapsedSeconds + 1 }));
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('Microphone access denied or audio recording failed: ' + err.message);
      setIsStartingRecording(false);
      setIsRecording(false);
    }
  };

  // 2. PAUSE RECITATION
  const pauseRecitation = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      const currentBlob = mediaRecorderRef.current.getCurrentAudioBlob();
      if (currentBlob) {
        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
        const currentUrl = URL.createObjectURL(currentBlob);
        updateTasmee({ isPaused: true, recordedAudioUrl: currentUrl, recordedAudioBlob: currentBlob });
      } else {
        updateTasmee({ isPaused: true });
      }
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
      setAnalysisStage('Flushing audio recording buffer...');
      mediaRecorderRef.current.stop();
    } catch (err) {
      console.error(err);
      alert('Failed to wrap up recitation: ' + err.message);
      setIsAnalyzing(false);
      setIsFinalizingStream(false);
    }
  };

  // 5. ABORT / DISCARD RECITATION
  const abortRecitation = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.abort();
    }

    const currentSessId = sessionIdRef.current;
    if (currentSessId) {
      const fd = new FormData();
      fd.append('session_id', currentSessId);
      fd.append('module_type', 'tasmee');
      fetch('/api/cancel_session', { method: 'POST', body: fd }).catch(() => {});
    }

    setIsRecording(false);
    setIsStartingRecording(false);
    setIsFinalizingStream(false);
    setIsAnalyzing(false);
    setAnalyserNode(null);
    setGradingError('');
    setNudgeActive(false);
    setNudgeText('');

    updateTasmee({
      isPaused: false,
      elapsedSeconds: 0,
      transcriptionData: [],
      evaluationResult: null
    });
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const matchCount =
    evaluationResult?.matches ??
    evaluationResult?.correct_words_count ??
    evaluationResult?.comparison?.filter((c) => c.status === 'match' || c.status === 'correct').length ??
    0;
  const mistakeCount =
    evaluationResult?.mistakes ??
    evaluationResult?.mistake_count ??
    evaluationResult?.comparison?.filter((c) => c.status === 'mistake' || c.status === 'incorrect').length ??
    0;
  const totalWords =
    evaluationResult?.total ??
    evaluationResult?.total_words ??
    evaluationResult?.comparison?.length ??
    0;
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

      {/* 2. Top Prominent Assessment Score Card (Zero-Scroll Visibility) */}
      {evaluationResult && (
        <div 
          ref={assessmentCardRef}
          className="glass-panel-gold rounded-2xl p-6 border border-gold-500/50 shadow-2xl space-y-6 animate-slideDown ring-1 ring-gold-500/20"
        >
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-extrabold text-2xl flex items-center justify-center shadow-gold-glow">
                {evaluationResult.score ?? evaluationResult.accuracy_score ?? 0}%
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-100">Assessment Score</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    (evaluationResult.score ?? evaluationResult.accuracy_score ?? 0) >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {(evaluationResult.score ?? evaluationResult.accuracy_score ?? 0) >= 90 ? 'Excellent' : (evaluationResult.score ?? evaluationResult.accuracy_score ?? 0) >= 75 ? 'Good' : 'Needs Practice'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Verified against Madani text standard.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-auto flex-wrap">
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

              {/* Manuscript Highlighting CTA */}
              <button
                onClick={() => handleOpenManuscriptModal()}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all ml-1"
                title="View this recitation with highlights on the Madani manuscript"
              >
                <Sparkle className="w-3.5 h-3.5 text-slate-950 fill-current animate-pulse" />
                <span>Highlight on Manuscript</span>
              </button>

              <button
                onClick={() => updateTasmee({ evaluationResult: null })}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-all ml-1"
                title="Dismiss Assessment Card"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {evaluationResult.user_transcription && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Transcribed Output:</span>
              <p dir="rtl" className="font-arabic text-lg text-amber-200 text-right">{evaluationResult.user_transcription}</p>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Word-by-Word Assessment (Tap words to inspect on manuscript)</span>
              <span className="text-gold-400 font-arabic text-sm">التدقيق الحرفي</span>
            </h4>

            <div 
              dir="rtl"
              className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap justify-start gap-3 text-right leading-loose font-arabic text-2xl"
            >
              {evaluationResult.comparison?.map((item, idx) => {
                const isMatch = item.status === 'match' || item.status === 'correct' || item.status === 'bismillah_skipped';
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleOpenManuscriptModal()}
                    className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-xl font-bold transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95 ${
                      isMatch
                        ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
                        : 'bg-red-950/70 border-red-500/50 text-red-300 hover:border-red-400 ring-1 ring-red-500/30 animate-pulse'
                    }`}
                    title={isMatch ? 'Recited correctly — click to inspect manuscript' : 'Recitation mistake — click to inspect manuscript'}
                  >
                    {item.word}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. Target Text & Audio Recording Section */}
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
                  onClick={() => setViewMode('manuscript')}
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
                    onClick={() => setActivePageIndex((prev) => Math.max(0, prev - 1))}
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
                    onClick={() => setActivePageIndex((prev) => Math.min(paginatedPages.length - 1, prev + 1))}
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
            {loadingText ? (
              <div className="flex items-center justify-center h-full gap-2 text-gold-400 text-xs font-semibold animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" /> Fetching target text from database...
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
                const minP = Math.min(Number(fromPage) || 1, Number(toPage) || 1);
                const maxP = Math.max(Number(fromPage) || 1, Number(toPage) || 1);
                for (let p = minP; p <= maxP; p++) pageRangeList.push(p);
              } else if (paginatedPages && paginatedPages.length > 0) {
                paginatedPages.forEach((pg, idx) => {
                  const parsedNum = Number(pg.page_number || pg.page);
                  if (!isNaN(parsedNum) && parsedNum > 0) {
                    pageRangeList.push(parsedNum);
                  } else {
                    pageRangeList.push(idx + 1);
                  }
                });
              } else if (rangeMode === 'surah') {
                const sStart = FULL_SURAH_LIST.find((s) => s.id === Number(startSurah));
                const sEnd = FULL_SURAH_LIST.find((s) => s.id === Number(endSurah)) || sStart;
                const minP = sStart?.startPage || 1;
                const maxP = sEnd?.endPage || sStart?.endPage || minP;
                for (let p = minP; p <= maxP; p++) pageRangeList.push(p);
              } else {
                pageRangeList.push(Number(fromPage) || 1);
              }

              const uniquePages = Array.from(new Set(pageRangeList)).sort((a, b) => a - b);

              return (
                <div className="space-y-6 select-none" dir="rtl">
                  {uniquePages.map((pageNum) => (
                    <div key={pageNum} className="space-y-2 border-b border-slate-900 pb-6 last:border-0">
                      <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-semibold text-slate-400 font-mono">
                          Manuscript Page {pageNum}
                        </span>
                        <button
                          onClick={() => handleOpenManuscriptModal(pageNum)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold hover:bg-amber-500/20 transition-all flex items-center gap-1"
                        >
                          <Sparkle className="w-3 h-3" />
                          <span>Highlight Verse</span>
                        </button>
                      </div>
                      <div className="flex justify-center p-2 bg-slate-950 rounded-xl border border-slate-900 min-h-[200px]">
                        <img
                          src={`/api/page_image/${pageNum}`}
                          alt={`Madani Quran Page ${pageNum}`}
                          onClick={() => handleOpenManuscriptModal(pageNum)}
                          className="max-h-[300px] object-contain rounded border border-slate-800 animate-fadeIn cursor-pointer transition-all hover:scale-[1.02] hover:border-gold-500/40 shadow-md"
                          title="Click to open manuscript with bounding box highlights"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  ))}
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
                <Mic className="w-4 h-4 text-gold-400" /> Audio Recording
              </h3>
              {isStartingRecording ? (
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800 animate-pulse flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" /> Connecting...
                </span>
              ) : isRecording ? (
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                  isPaused 
                    ? 'text-yellow-400 bg-yellow-950/40 border-yellow-800' 
                    : 'text-red-400 bg-red-950 border-red-800 animate-pulse'
                }`}>
                  {isPaused ? 'PAUSED' : 'REC'}: {formatTime(elapsedSeconds)}
                </span>
              ) : null}
            </div>

            {/* Live Audio Visualizer */}
            <div className="py-2">
              <AudioVisualizer analyser={analyserNode} isRecording={isRecording && !isPaused} />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              {!isRecording ? (
                <button
                  onClick={initiateRecitation}
                  disabled={!expectedText || isStartingRecording || isAnalyzing}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-gold-glow transition-all disabled:opacity-40"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Recitation</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  {isPaused ? (
                    <button
                      onClick={resumeRecitation}
                      className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                    >
                      <Play className="w-4 h-4" /> Resume
                    </button>
                  ) : (
                    <button
                      onClick={pauseRecitation}
                      className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-gold-300 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-gold-500/30 transition-all"
                    >
                      <Pause className="w-4 h-4" /> Pause
                    </button>
                  )}

                  <button
                    onClick={concludeRecitation}
                    disabled={isFinalizingStream}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-gold-glow transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Conclude
                  </button>

                  <button
                    onClick={abortRecitation}
                    className="p-3 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/40 transition-all"
                    title="Discard Recording"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Error or Nudge Banners */}
            {gradingError && (
              <div className="mt-3 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{gradingError}</span>
              </div>
            )}

            {nudgeActive && (
              <div className="mt-3 p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs flex items-center gap-2 animate-bounce">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{nudgeText}</span>
              </div>
            )}

            {isAnalyzing && (
              <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-gold-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-gold-400 font-semibold">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {analysisStage}
                  </span>
                  <span>{analysisProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-amber-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Playback Controls if recorded audio exists */}
            {recordedAudioUrl && !isRecording && (
              <div className="mt-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Self-Check Audio:
                  </span>
                  <div className="flex items-center gap-1 text-[10px]">
                    {[1.0, 1.25, 1.5].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => {
                          setPlaybackSpeed(spd);
                          if (audioPlayerRef.current) audioPlayerRef.current.playbackRate = spd;
                        }}
                        className={`px-1.5 py-0.5 rounded ${playbackSpeed === spd ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
                <audio ref={audioPlayerRef} src={recordedAudioUrl} controls className="w-full h-8" />
              </div>
            )}

            {/* Live Whisper Real-Time Stream Box */}
            <div className="mt-4 border-t border-slate-800 pt-3 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Live Speech Stream Monitor:
              </span>
              <div 
                ref={correctionsContainerRef}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[90px] max-h-[140px] overflow-y-auto text-right font-arabic text-xl leading-relaxed"
                dir="rtl"
              >
                {(() => {
                  if (transcriptionData && transcriptionData.length > 0) {
                    return transcriptionData.map((item, idx) => {
                      const isCorrect = item.status === 'correct' || item.status === 'match';
                      const isSkipped = item.status === 'bismillah_skipped';
                      const isMistake = item.status === 'mistake' || item.status === 'incorrect';
                      const wordText = item.word || item.text || (typeof item === 'string' ? item : JSON.stringify(item));
                      
                      let styleClass = 'text-slate-400';
                      if (isCorrect) {
                        styleClass = 'text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-500/40 px-2 py-0.5 rounded-lg shadow-sm';
                      } else if (isSkipped) {
                        styleClass = 'text-slate-400 italic text-xl border-b border-slate-700/60 bg-slate-900/40 px-1.5 py-0.5 rounded';
                      } else if (isMistake) {
                        styleClass = 'text-red-400 line-through decoration-red-500/80 decoration-2 font-bold bg-red-950/50 border border-red-500/40 px-2 py-0.5 rounded-lg';
                      }

                      return (
                        <span
                          key={idx}
                          className={`inline-block mx-1 my-0.5 transition-all duration-200 ${styleClass}`}
                          title={isSkipped ? 'Bismillah skipped (optional opening)' : isCorrect ? 'Recited correctly' : isMistake ? 'Recitation mistake' : ''}
                        >
                          {wordText}
                        </span>
                      );
                    });
                  }

                  return (
                    <div className="w-full text-center text-slate-500 font-sans text-xs py-3.5 tracking-wide">
                      {isRecording ? (
                        <span className="flex items-center justify-center gap-2 text-amber-400 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          Listening... Recite in Arabic
                        </span>
                      ) : (
                        'Awaiting recitation start...'
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manuscript Lightbox Modal with Coordinate Bounding Box Overlay */}
      {modalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-gold-400 border border-amber-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Madani Manuscript</span>
                    <span className="text-xs text-amber-600 dark:text-gold-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      Page {modalTarget.page} ({currentZoomedIndex + 1}/{zoomedPageList.length})
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Recitation range mapped with coordinate bounds on the printed manuscript.
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {/* Previous Page Navigation */}
                <button
                  onClick={() => {
                    if (currentZoomedIndex > 0) {
                      const prevIdx = currentZoomedIndex - 1;
                      handleModalPageChange(zoomedPageList[prevIdx]);
                    }
                  }}
                  disabled={currentZoomedIndex <= 0}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Previous Page (RTL Next)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Next Page Navigation */}
                <button
                  onClick={() => {
                    if (currentZoomedIndex < zoomedPageList.length - 1) {
                      const nextIdx = currentZoomedIndex + 1;
                      handleModalPageChange(zoomedPageList[nextIdx]);
                    }
                  }}
                  disabled={currentZoomedIndex >= zoomedPageList.length - 1}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Next Page (RTL Prev)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

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
                    handleJumpToTilawat(modalTarget.page);
                    setModalTarget(null);
                  }}
                  className="hidden sm:flex px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs items-center gap-1.5 shadow"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tilawat</span>
                </button>

                <button
                  onClick={() => setModalTarget(null)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body with Bounding Boxes */}
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

                  {/* Overlaid Highlight Boxes */}
                  {modalBoxes.map((box, idx) => {
                    const isSpecificMatch =
                      modalTarget.specificAyah &&
                      Number(box.sura) === Number(modalTarget.specificAyah.sura) &&
                      Number(box.ayah) === Number(modalTarget.specificAyah.ayah);

                    const leftPct = (box.min_x / modalDimensions.width) * 100;
                    const topPct = (box.min_y / modalDimensions.height) * 100;
                    const widthPct = ((box.max_x - box.min_x) / modalDimensions.width) * 100;
                    const heightPct = ((box.max_y - box.min_y) / modalDimensions.height) * 100;

                    return (
                      <div
                        key={`tasmee-box-${box.global_id}-${idx}`}
                        className={`absolute z-20 rounded-md transition-all ${
                          isSpecificMatch
                            ? 'bg-rose-500/35 border-2 border-rose-500 shadow-lg ring-2 ring-rose-400/50 animate-pulse'
                            : 'bg-amber-400/20 hover:bg-amber-400/35 border border-amber-500/40 shadow-gold-glow'
                        }`}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`
                        }}
                        title={`Surah ${box.sura}, Ayah ${box.ayah}`}
                      >
                        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-amber-500/80 rounded-full" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Bottom Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-amber-50/40 dark:bg-slate-950 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span className="flex items-center gap-2">
                <Sparkle className="w-3.5 h-3.5 text-amber-500" />
                <span>Page {modalTarget.page} • Interactive Coordinate Bounding Boxes</span>
              </span>
              <span>Use Arrow Keys or buttons to browse pages in the recitation range</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasmeeTab;
