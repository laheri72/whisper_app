import React, { useEffect, useRef, useState } from 'react';
import { 
  Award, HelpCircle, ChevronDown, ChevronUp, Mic, MicOff, RefreshCw, 
  CheckCircle2, AlertCircle, Sparkles, BookOpen, Pause, Play, Download, 
  X, Trash2, Volume2, ZoomIn, ZoomOut, ExternalLink, Eye, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { getJuzPageRange, JUZ_LIST, SURAH_LIST, FULL_SURAH_LIST } from '../utils/juzMapping';
import { WaveMediaRecorder } from '../utils/audioRecorder';
import { AudioVisualizer } from './AudioVisualizer';
import { useApp } from '../context/AppContext';

export const IkhtebaarTab = () => {
  const { 
    ikhtebaarState, updateIkhtebaar, quranData, fetchQuranData, 
    loadingJson, isModelReady, modelStatus, modelError,
    setActiveTab = () => {}, updateTilawat = () => {}
  } = useApp();

  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioPlayerRef = useRef(null);

  const {
    rangeMode = 'juz',
    selectedJuz = 1,
    fromPage = 1,
    toPage = 21,
    startSurah = 112,
    endSurah = 112,
    difficulty = 'medium',
    currentQuestion = null,
    excludedQuestions = [],
    activeHint = null,
    gradeResult = null,
    elapsedSeconds = 0,
    recordedAudioUrl = '',
    recordedAudioBlob = null,
    whisperCorrections = '',
    transcriptionData = [],
    isPaused = false
  } = ikhtebaarState || {};

  // Stateful setters mapped to context updates
  const setRangeMode = (val) => updateIkhtebaar({ rangeMode: typeof val === 'function' ? val(rangeMode) : val });
  const setSelectedJuz = (val) => updateIkhtebaar({ selectedJuz: typeof val === 'function' ? val(selectedJuz) : val });
  const setFromPage = (val) => updateIkhtebaar({ fromPage: typeof val === 'function' ? val(fromPage) : val });
  const setToPage = (val) => updateIkhtebaar({ toPage: typeof val === 'function' ? val(toPage) : val });
  const setStartSurah = (val) => updateIkhtebaar({ startSurah: typeof val === 'function' ? val(startSurah) : val });
  const setEndSurah = (val) => updateIkhtebaar({ endSurah: typeof val === 'function' ? val(endSurah) : val });
  const setDifficulty = (val) => updateIkhtebaar({ difficulty: typeof val === 'function' ? val(difficulty) : val });
  const setCurrentQuestion = (val) => updateIkhtebaar({ currentQuestion: typeof val === 'function' ? val(currentQuestion) : val });
  const setExcludedQuestions = (val) => updateIkhtebaar({ excludedQuestions: typeof val === 'function' ? val(excludedQuestions) : val });
  const setActiveHint = (val) => updateIkhtebaar({ activeHint: typeof val === 'function' ? val(activeHint) : val });
  const setGradeResult = (val) => updateIkhtebaar({ gradeResult: typeof val === 'function' ? val(gradeResult) : val });

  // Transient UI states
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState('');
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

  // Multi-Page Manuscript Lightbox Modal State with Dual-Anchor Highlights
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomedPageList, setZoomedPageList] = useState([]);
  const [currentZoomedIndex, setCurrentZoomedIndex] = useState(0);
  const [modalBoxes, setModalBoxes] = useState([]);
  const [loadingModalBoxes, setLoadingModalBoxes] = useState(false);
  const [modalDimensions, setModalDimensions] = useState({ width: 1000, height: 1000 });
  const [modalZoom, setModalZoom] = useState(1);

  const mediaRecorderRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);
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
    if (gradeResult && assessmentCardRef.current) {
      assessmentCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [gradeResult]);

  // Apply Juz page range calculations
  useEffect(() => {
    if (rangeMode === 'juz') {
      const range = getJuzPageRange(selectedJuz);
      updateIkhtebaar({
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

  // Fetch bounding boxes for current modal page
  const currentModalPage = zoomedPageList[currentZoomedIndex];

  useEffect(() => {
    if (!isZoomed || !currentModalPage) {
      setModalBoxes([]);
      return;
    }

    let isMounted = true;
    setLoadingModalBoxes(true);
    fetch(`/api/page_boxes/${currentModalPage}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setModalBoxes(data.boxes || []);
        }
      })
      .catch((err) => {
        console.error('Error fetching page boxes for exam modal:', err);
        if (isMounted) setModalBoxes([]);
      })
      .finally(() => {
        if (isMounted) setLoadingModalBoxes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isZoomed, currentModalPage]);

  // Handle Keyboard Navigation inside Zoom Modal (RTL logic)
  useEffect(() => {
    if (!isZoomed || zoomedPageList.length === 0) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsZoomed(false);
      } else if (e.key === 'ArrowLeft') {
        if (currentZoomedIndex < zoomedPageList.length - 1) {
          setCurrentZoomedIndex((prev) => prev + 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (currentZoomedIndex > 0) {
          setCurrentZoomedIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isZoomed, currentZoomedIndex, zoomedPageList]);

  // Open full manuscript viewer spanning from Start Verse page to Stop Verse page
  const handleViewFullPage = (targetPage = null) => {
    if (!currentQuestion) return;
    const startPage = Number(currentQuestion?.page_number || 1);
    const endPage = Number(currentQuestion?.end_page_number || startPage);

    const minPage = Math.min(startPage, endPage);
    const maxPage = Math.max(startPage, endPage);
    const pageRangeList = [];
    for (let p = minPage; p <= maxPage; p++) {
      pageRangeList.push(p);
    }

    setZoomedPageList(pageRangeList);
    const target = targetPage !== null ? Number(targetPage) : startPage;
    const idx = pageRangeList.indexOf(target);
    setCurrentZoomedIndex(idx >= 0 ? idx : 0);
    setModalZoom(1);
    setIsZoomed(true);
  };

  const handleJumpToTilawat = (pageNum) => {
    updateTilawat({
      pageNumber: Number(pageNum)
    });
    setActiveTab('tilawat');
  };

  // Fetch AI Question from /api/generate_ikhtebaar
  const generateQuestion = async () => {
    setIsLoadingQuestion(true);
    setQuestionError('');
    setGradeResult(null);
    setGradingError('');
    setNudgeActive(false);
    setNudgeText('');
    updateIkhtebaar({
      activeHint: null,
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
      const excludeParam = (excludedQuestions || []).join(',');
      const url = `/api/generate_ikhtebaar?mode=${encodeURIComponent(modeParam)}&start_val=${encodeURIComponent(startVal)}&end_val=${encodeURIComponent(endVal)}&difficulty=${encodeURIComponent(difficulty)}&exclude=${encodeURIComponent(excludeParam)}`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        setQuestionError(data.error);
        setCurrentQuestion(null);
      } else {
        updateIkhtebaar({
          currentQuestion: data,
          excludedQuestions: [...excludedQuestions, data.question_id]
        });
      }
    } catch (err) {
      console.error(err);
      setQuestionError('Failed to generate exam question.');
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  // 1. INITIATE RECITATION (Stateful Live Session Streaming Mode)
  const initiateRecitation = async () => {
    if (!currentQuestion) {
      alert('Please generate an exam question before initiating recitation.');
      return;
    }

    if (!isModelReady) {
      alert('AI Recitation model is loading. Please wait a moment until ready.');
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

      updateIkhtebaar({
        recordedAudioUrl: '',
        recordedAudioBlob: null,
        whisperCorrections: '',
        transcriptionData: [],
        isPaused: false,
        gradeResult: null,
        elapsedSeconds: 0
      });

      const sessId = 'sess_ikhtebaar_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      sessionIdRef.current = sessId;
      chunkIndexRef.current = 0;
      abortControllerRef.current = new AbortController();

      // Start server-side stateful session
      const startFormData = new FormData();
      startFormData.append('session_id', sessId);
      startFormData.append('expected_text', currentQuestion.expected_full_text || currentQuestion.arabic_text || '');
      startFormData.append('range_mode', rangeMode);
      startFormData.append('start_val', rangeMode === 'surah' ? startSurah : rangeMode === 'page' ? fromPage : selectedJuz);
      startFormData.append('end_val', rangeMode === 'surah' ? endSurah : rangeMode === 'page' ? toPage : selectedJuz);
      startFormData.append('question_id', currentQuestion.question_id || '');

      const startRes = await fetch('/api/ikhtebaar/start_session', {
        method: 'POST',
        body: startFormData,
        signal: abortControllerRef.current.signal
      });
      if (startRes.ok) {
        const startData = await startRes.json();
        if (startData.word_status) {
          updateIkhtebaar({
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

        return fetch('/api/ikhtebaar/chunk', {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current?.signal
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data.word_status) {
              updateIkhtebaar({
                transcriptionData: data.word_status
              });
            }

            if (data.nudge) {
              setNudgeActive(true);
              setNudgeText('Recite the next word clearly...');
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
        setAnalysisStage('Grading Recitation...');

        const finalUrl = URL.createObjectURL(finalBlob);
        updateIkhtebaar({
          recordedAudioBlob: finalBlob,
          recordedAudioUrl: finalUrl
        });

        try {
          const formData = new FormData();
          formData.append('session_id', sessionIdRef.current);
          formData.append('file', finalBlob, 'full_exam.wav');

          const response = await fetch('/api/ikhtebaar/conclude_session', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Examination grading failed.');
          }

          const resultData = await response.json();
          setAnalysisProgress(100);
          setAnalysisStage('Assessment Complete!');
          await new Promise((r) => setTimeout(r, 200));
          setGradeResult(resultData);
        } catch (err) {
          if (err.name === 'AbortError') {
            console.log('Exam conclusion request aborted.');
          } else {
            console.error('Evaluation error:', err);
            setGradingError('Failed to finalize exam: ' + err.message);
          }
        } finally {
          setIsAnalyzing(false);
          setAnalyserNode(null);
          setAnalysisProgress(0);
          setAnalysisStage('');
        }
      };

      // Start recorder with 6-second chunking
      recorder.start(6000);
      setAnalyserNode(recorder.getAnalyser());
      setIsStartingRecording(false);
      setIsRecording(true);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        updateIkhtebaar((prev) => ({ elapsedSeconds: prev.elapsedSeconds + 1 }));
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('Microphone access denied or recording failed: ' + err.message);
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
        updateIkhtebaar({ isPaused: true, recordedAudioUrl: currentUrl, recordedAudioBlob: currentBlob });
      } else {
        updateIkhtebaar({ isPaused: true });
      }
    }
  };

  // 3. RESUME RECITATION
  const resumeRecitation = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      updateIkhtebaar({ isPaused: false });
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
      setAnalysisStage('Processing final audio...');
      mediaRecorderRef.current.stop();
    } catch (err) {
      console.error(err);
      alert('Failed to finish exam: ' + err.message);
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
      fd.append('module_type', 'ikhtebaar');
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

    updateIkhtebaar({
      isPaused: false,
      elapsedSeconds: 0,
      transcriptionData: [],
      gradeResult: null
    });
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const matchCount =
    gradeResult?.matches ??
    gradeResult?.correct_words_count ??
    gradeResult?.comparison?.filter((c) => c.status === 'match' || c.status === 'correct').length ??
    0;
  const mistakeCount =
    gradeResult?.mistakes ??
    gradeResult?.mistake_count ??
    gradeResult?.comparison?.filter((c) => c.status === 'mistake' || c.status === 'incorrect').length ??
    0;
  const totalWords =
    gradeResult?.total ??
    gradeResult?.total_words ??
    gradeResult?.comparison?.length ??
    0;

  // Dual Anchor identifiers
  const startSura = Number(currentQuestion?.surah_number || currentQuestion?.question_id?.split('-')[0] || 0);
  const startAyah = Number(currentQuestion?.ayah_number || currentQuestion?.question_id?.split('-')[1] || 0);
  const endSura = Number(currentQuestion?.end_surah_number || startSura);
  const endAyah = Number(currentQuestion?.end_ayah_number || 0);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Exam Configuration Card */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-gold-400" /> Oral Examination Configurator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select your testing range and difficulty to generate an exam prompt.
            </p>
          </div>

          {/* Range Mode Switcher */}
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

        {/* Dynamic configurations */}
        <div className="flex flex-wrap items-center gap-6">
          {rangeMode === 'juz' && (
            <div className="flex items-center gap-4 flex-1 min-w-[280px]">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-400 mb-1">Select Juz:</label>
                <select
                  value={selectedJuz}
                  onChange={(e) => setSelectedJuz(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 text-gold-300 font-bold text-sm rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-amber-500"
                >
                  {JUZ_LIST.map((j) => (
                    <option key={j.id} value={j.id}>{j.displayLabel}</option>
                  ))}
                </select>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/90 border border-gold-500/30 text-center">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Exam Span</span>
                <span className="text-xs font-mono font-bold text-amber-400">Page {fromPage} → {toPage}</span>
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

          {/* Difficulty Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Difficulty:</label>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              {['easy', 'medium', 'hard'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase ${
                    difficulty === d
                      ? d === 'easy' ? 'bg-emerald-500 text-slate-950 shadow-md font-bold' : d === 'medium' ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'bg-red-500 text-white shadow-md font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Question Button */}
          <button
            onClick={generateQuestion}
            disabled={isLoadingQuestion}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-gold-glow transition-all disabled:opacity-50 ml-auto"
          >
            {isLoadingQuestion ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
            <span>Generate Question</span>
          </button>
        </div>
      </div>

      {/* 2. Top Prominent Assessment Score Card */}
      {gradeResult && (
        <div 
          ref={assessmentCardRef}
          className="glass-panel-gold rounded-2xl p-6 border border-gold-500/50 shadow-2xl space-y-6 animate-slideDown ring-1 ring-gold-500/20"
        >
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-extrabold text-2xl flex items-center justify-center shadow-gold-glow">
                {gradeResult.score ?? gradeResult.accuracy_score ?? 0}%
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-100">Assessment Score</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    (gradeResult.score ?? gradeResult.accuracy_score ?? 0) >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {(gradeResult.score ?? gradeResult.accuracy_score ?? 0) >= 85 ? 'Passed - Mastered' : (gradeResult.score ?? gradeResult.accuracy_score ?? 0) >= 70 ? 'Passed - Needs Revision' : 'Needs Practice'}
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

              {/* View on Mushaf CTA */}
              <button
                onClick={() => handleViewFullPage()}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all ml-1"
                title="View exam recitation on the Madani Mushaf"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>View on Mushaf</span>
              </button>

              <button
                onClick={() => updateIkhtebaar({ gradeResult: null })}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-all ml-1"
                title="Dismiss Assessment Card"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {gradeResult.user_transcription && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Transcribed Output:</span>
              <p dir="rtl" className="font-arabic text-lg text-amber-200 text-right">{gradeResult.user_transcription}</p>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Word-by-Word Assessment (Tap words to inspect on Mushaf)</span>
              <span className="text-gold-400 font-arabic text-sm">التدقيق الحرفي</span>
            </h4>

            <div 
              dir="rtl"
              className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap justify-start gap-3 text-right leading-loose font-arabic text-2xl"
            >
              {gradeResult.comparison?.map((item, idx) => {
                const isMatch = item.status === 'match' || item.status === 'correct' || item.status === 'bismillah_skipped';
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleViewFullPage()}
                    className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-xl font-bold transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95 ${
                      isMatch
                        ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
                        : 'bg-red-950/70 border-red-500/50 text-red-300 hover:border-red-400 ring-1 ring-red-500/30 animate-pulse'
                    }`}
                    title={isMatch ? 'Recited correctly — click to view on Mushaf' : 'Recitation mistake — click to view on Mushaf'}
                  >
                    {item.word}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. Question Prompt Card & Audio controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Card: Exam Question Prompt */}
        <div className="glass-panel rounded-2xl p-6 border border-gold-500/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-gold-400" /> Exam Question
            </h3>
            {currentQuestion && (
              <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                Difficulty: {difficulty}
              </span>
            )}
          </div>

          {currentQuestion ? (() => {
            const surahName = currentQuestion?.surah_name || `Surah ${currentQuestion?.surah_number || currentQuestion?.sura_number || ''}`;
            const pageNumber = currentQuestion?.page_number || '';
            const ayahNumber = currentQuestion?.ayah_number || currentQuestion?.start_ayah_num || '';
            const arabicText = currentQuestion?.arabic_text || currentQuestion?.start_text || '';
            const endSurahName = currentQuestion?.end_surah_name || surahName;
            const endPageNumber = currentQuestion?.end_page_number || pageNumber;
            const endAyahNumber = currentQuestion?.end_ayah_number || '...';
            const endArabicText = currentQuestion?.end_arabic_text || currentQuestion?.stop_text || '...';

            return (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Recite aloud from the start verse below until you reach the stop verse.
                </p>

                {/* Start Ayah Prompt (Emerald Green Anchor) */}
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Start Verse: {surahName}, Ayah {ayahNumber}
                    </span>
                    <span className="font-mono text-emerald-400/90 text-[11px]">
                      Page {pageNumber}
                    </span>
                  </div>
                  <p dir="rtl" className="font-arabic text-2xl text-emerald-100 text-right leading-loose pt-1">
                    {arabicText}
                  </p>
                </div>

                {/* Stop Ayah Prompt (Amber / Gold Anchor) */}
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/40 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Stop Verse: {endSurahName}, Ayah {endAyahNumber}
                    </span>
                    <span className="font-mono text-amber-400/90 text-[11px]">
                      Page {endPageNumber}
                    </span>
                  </div>
                  <p dir="rtl" className="font-arabic text-2xl text-amber-100/95 text-right leading-loose pt-1">
                    {endArabicText}
                  </p>
                </div>

                {/* Single Clean View on Mushaf CTA */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-xs text-slate-300 font-medium">
                    Exam Span: <strong className="text-amber-400">P. {pageNumber}</strong> → <strong className="text-amber-400">P. {endPageNumber}</strong>
                  </div>
                  <button
                    onClick={() => handleViewFullPage()}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition-all"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>View on Mushaf</span>
                  </button>
                </div>

                {/* Help Hints Accordion */}
                <div className="space-y-2 pt-1">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hints & Context:</span>

                  {/* Hint 1 */}
                  <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                    <button
                      onClick={() => setActiveHint(activeHint === 'hint_1' ? null : 'hint_1')}
                      className="w-full p-2.5 text-left text-xs font-semibold text-slate-300 flex items-center justify-between hover:bg-slate-900 transition-all"
                    >
                      <span>Hint 1: First Ayah on Page {pageNumber}</span>
                      {activeHint === 'hint_1' ? <ChevronUp className="w-3.5 h-3.5 text-gold-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                    {activeHint === 'hint_1' && (
                      <div dir="rtl" className="p-3.5 border-t border-slate-800 text-right font-arabic text-xl text-amber-200 bg-slate-900/60">
                        {currentQuestion?.hint_1 || 'No hint available'}
                      </div>
                    )}
                  </div>

                  {/* Hint 2 */}
                  <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                    <button
                      onClick={() => setActiveHint(activeHint === 'hint_2' ? null : 'hint_2')}
                      className="w-full p-2.5 text-left text-xs font-semibold text-slate-300 flex items-center justify-between hover:bg-slate-900 transition-all"
                    >
                      <span>Hint 2: Surah Identifier</span>
                      {activeHint === 'hint_2' ? <ChevronUp className="w-3.5 h-3.5 text-gold-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                    {activeHint === 'hint_2' && (
                      <div className="p-3.5 border-t border-slate-800 text-xs font-bold text-amber-300 bg-slate-900/60">
                        {currentQuestion?.hint_2 || 'No hint available'}
                      </div>
                    )}
                  </div>

                  {/* Hint 3 */}
                  <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                    <button
                      onClick={() => setActiveHint(activeHint === 'hint_3' ? null : 'hint_3')}
                      className="w-full p-2.5 text-left text-xs font-semibold text-slate-300 flex items-center justify-between hover:bg-slate-900 transition-all"
                    >
                      <span>Hint 3: Preceding Passage Context</span>
                      {activeHint === 'hint_3' ? <ChevronUp className="w-3.5 h-3.5 text-gold-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                    {activeHint === 'hint_3' && (
                      <div dir="rtl" className="p-3.5 border-t border-slate-800 text-right font-arabic text-xl text-amber-200 bg-slate-900/60">
                        {currentQuestion?.hint_3 || 'No hint available'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold space-y-2">
              <HelpCircle className="w-8 h-8 mx-auto text-slate-500" />
              {questionError ? (
                <p className="text-red-400 font-bold">{questionError}</p>
              ) : (
                <p>Click "Generate Question" above to begin an oral exam.</p>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Recitation & Audio Controls */}
        <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl flex flex-col justify-between space-y-5 lg:sticky lg:top-6 self-start">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-gold-400" /> Recitation & Grading
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
          </div>

          {/* Live Audio Visualizer */}
          <AudioVisualizer analyser={analyserNode} isRecording={isRecording && !isPaused} className="h-28" />

          {/* Action Buttons */}
          <div className="space-y-3">
            {isStartingRecording ? (
              <div className="py-4 rounded-xl bg-slate-900 border border-amber-500/40 text-center text-amber-300 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Activating Microphone...</span>
              </div>
            ) : isFinalizingStream ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 text-center space-y-2 animate-pulse">
                <div className="flex items-center justify-center gap-2 text-amber-300 text-xs font-bold">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Grading Recitation...</span>
                </div>
              </div>
            ) : isAnalyzing ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-gold-500/40 shadow-gold-glow space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gold-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" /> Evaluation in Progress
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-400 font-extrabold">{analysisProgress}%</span>
                    <button
                      onClick={abortRecitation}
                      className="p-1 rounded-md bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/40 text-[10px] transition-all flex items-center gap-1"
                      title="Abort and discard evaluation"
                    >
                      <Trash2 className="w-3 h-3" /> Abort
                    </button>
                  </div>
                </div>

                <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300 shadow-gold-glow"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>

                <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                  <span className="animate-pulse text-slate-300 font-semibold">{analysisStage}</span>
                  <span className="text-amber-400/80 font-mono text-[10px]">Live Analysis</span>
                </div>
              </div>
            ) : !isRecording ? (
              <div className="space-y-3">
                <button
                  onClick={initiateRecitation}
                  disabled={!currentQuestion || !isModelReady || isStartingRecording}
                  className={`w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                    !isModelReady
                      ? 'bg-amber-950/60 border border-amber-500/30 text-amber-300 cursor-not-allowed opacity-80'
                      : !currentQuestion
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-emerald-500/20 active:scale-[0.99]'
                  }`}
                >
                  {!isModelReady ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Model Initializing...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>Start Recitation</span>
                    </>
                  )}
                </button>

                {/* Audio Self-Auditing & Playback Controls */}
                {recordedAudioUrl && (
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-gold-500/30 space-y-2.5 animate-fadeIn shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gold-300 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Playback:
                      </span>
                      {/* Playback speed selector */}
                      <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                        {[0.75, 1.0, 1.25].map((spd) => (
                          <button
                            key={spd}
                            onClick={() => {
                              setPlaybackSpeed(spd);
                              if (audioPlayerRef.current) audioPlayerRef.current.playbackRate = spd;
                            }}
                            className={`px-1.5 py-0.5 rounded ${playbackSpeed === spd ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <audio
                      ref={audioPlayerRef}
                      src={recordedAudioUrl}
                      controls
                      className="w-full h-9 rounded-lg accent-amber-500"
                    />
                    
                    <div className="flex items-center gap-2">
                      <a
                        href={recordedAudioUrl}
                        download="ikhtebaar_recitation.wav"
                        className="flex-1 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-gold-500/40 text-gold-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" /> Export Audio
                      </a>
                      <button
                        onClick={() => {
                          if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
                          updateIkhtebaar({ recordedAudioUrl: '', recordedAudioBlob: null });
                        }}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-400 text-xs transition-all"
                        title="Clear audio player"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Recording Controls: Pause/Resume + Abort Icon */}
                <div className="flex gap-2 items-center">
                  {isPaused ? (
                    <button
                      onClick={resumeRecitation}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <Play className="w-4 h-4" /> Resume
                    </button>
                  ) : (
                    <button
                      onClick={pauseRecitation}
                      className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-gold-300 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-gold-500/30 transition-all shadow-md"
                    >
                      <Pause className="w-4 h-4" /> Pause
                    </button>
                  )}

                  <button
                    onClick={abortRecitation}
                    className="p-3 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/40 transition-all"
                    title="Abort Recitation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Conclude Exam Button */}
                <button
                  onClick={concludeRecitation}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-gold-glow transition-all active:scale-[0.99]"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Conclude Recitation & Grade</span>
                </button>
              </div>
            )}

            {/* Error or Nudge Banners */}
            {gradingError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{gradingError}</span>
              </div>
            )}

            {nudgeActive && (
              <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs flex items-center gap-2 animate-bounce">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{nudgeText}</span>
              </div>
            )}

            {/* Real-time transcription dynamic panel */}
            <div className="p-4 rounded-xl bg-slate-950/85 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Live Recitation:
                </span>
                <span className="text-gold-400 font-arabic text-sm" dir="rtl">متابعة التسميع</span>
              </div>
              <div 
                ref={correctionsContainerRef}
                dir="rtl"
                className="max-h-[170px] min-h-[65px] overflow-y-auto p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-right leading-[2.5] font-arabic text-2xl select-text shadow-inner"
              >
                {(() => {
                  const verifiedWords = (transcriptionData || []).filter(
                    (item) => item.isRawString || (item.status && item.status !== 'pending')
                  );

                  if (verifiedWords.length > 0) {
                    return verifiedWords.map((item, idx) => {
                      if (item.isRawString) {
                        return (
                          <span key={idx} className="inline-block mx-1 my-0.5 text-amber-200/90 font-medium">
                            {item.text}
                          </span>
                        );
                      }
                      const isCorrect = item.status === 'match' || item.status === 'correct' || item.correct === true || item.status === 'equal';
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
                          title={isSkipped ? 'Bismillah skipped' : isCorrect ? 'Recited correctly' : isMistake ? 'Mistake' : ''}
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

      {/* Multi-Page Manuscript Lightbox Modal with Dual-Anchor Highlighting (Start: Green, Stop: Amber) */}
      {isZoomed && zoomedPageList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-gold-400 border border-amber-500/30">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Madani Mushaf • Exam Pages
                    </h3>
                    <span className="text-xs text-amber-600 dark:text-gold-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      Page {currentModalPage} ({currentZoomedIndex + 1}/{zoomedPageList.length})
                    </span>
                  </div>

                  {/* Dual-Anchor Badges in Header */}
                  {currentQuestion && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px] font-mono">
                      <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Start: {currentQuestion.surah_name || `Surah ${startSura}`} ({currentQuestion.ayah_number || startAyah}) • P. {currentQuestion.page_number}
                      </span>
                      <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Stop: {currentQuestion.end_surah_name || `Surah ${endSura}`} ({currentQuestion.end_ayah_number || endAyah}) • P. {currentQuestion.end_page_number}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Header Controls */}
              <div className="flex items-center gap-2">
                {/* Previous Page Navigation */}
                <button
                  onClick={() => setCurrentZoomedIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentZoomedIndex <= 0}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  title="Previous Page (RTL Next)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Next Page Navigation */}
                <button
                  onClick={() => setCurrentZoomedIndex((prev) => Math.min(zoomedPageList.length - 1, prev + 1))}
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
                    handleJumpToTilawat(currentModalPage);
                    setIsZoomed(false);
                  }}
                  className="hidden sm:flex px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs items-center gap-1.5 shadow transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tilawat</span>
                </button>

                <button
                  onClick={() => setIsZoomed(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 ml-1 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body with Dual-Anchor Highlighting Overlay */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 dark:bg-slate-950 select-none relative min-h-[400px]">
              {loadingModalBoxes ? (
                <div className="flex flex-col items-center justify-center gap-3 text-amber-500 py-20">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                  <span className="text-xs font-semibold font-mono uppercase tracking-wider">
                    Loading Manuscript Page...
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
                    src={`/api/page_image/${currentModalPage}`}
                    alt={`Manuscript Page ${currentModalPage}`}
                    onLoad={(e) => {
                      const { naturalWidth, naturalHeight } = e.target;
                      if (naturalWidth && naturalHeight) {
                        setModalDimensions({ width: naturalWidth, height: naturalHeight });
                      }
                    }}
                    className="block max-h-[65vh] w-auto object-contain p-0 m-0 mx-auto select-none pointer-events-none"
                  />

                  {/* Overlaid Dual-Anchor Highlight Boxes */}
                  {modalBoxes.map((box, idx) => {
                    const isStartVerse = Number(box.sura) === startSura && Number(box.ayah) === startAyah;
                    const isEndVerse = Number(box.sura) === endSura && Number(box.ayah) === endAyah;

                    // Range check for intermediate verses
                    const isWithinExamRange = (() => {
                      if (isStartVerse || isEndVerse) return false;
                      if (!startSura || !endSura) return false;
                      if (startSura === endSura) {
                        return Number(box.sura) === startSura && Number(box.ayah) > startAyah && Number(box.ayah) < endAyah;
                      }
                      if (Number(box.sura) === startSura) return Number(box.ayah) > startAyah;
                      if (Number(box.sura) === endSura) return Number(box.ayah) < endAyah;
                      return Number(box.sura) > startSura && Number(box.sura) < endSura;
                    })();

                    const leftPct = (box.min_x / modalDimensions.width) * 100;
                    const topPct = (box.min_y / modalDimensions.height) * 100;
                    const widthPct = ((box.max_x - box.min_x) / modalDimensions.width) * 100;
                    const heightPct = ((box.max_y - box.min_y) / modalDimensions.height) * 100;

                    if (isStartVerse) {
                      return (
                        <div
                          key={`ikhtebaar-start-${box.global_id}-${idx}`}
                          className="absolute z-30 rounded-md bg-emerald-500/35 border-2 border-emerald-400 shadow-emerald-glow ring-2 ring-emerald-400/60 animate-pulse transition-all"
                          style={{
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`
                          }}
                          title={`Start Verse: Surah ${box.sura}, Ayah ${box.ayah}`}
                        >
                          <div className="absolute -bottom-1 left-0 right-0 h-1 bg-emerald-400 rounded-full shadow-md" />
                        </div>
                      );
                    }

                    if (isEndVerse) {
                      return (
                        <div
                          key={`ikhtebaar-end-${box.global_id}-${idx}`}
                          className="absolute z-30 rounded-md bg-amber-400/35 border-2 border-amber-400 shadow-gold-glow ring-2 ring-amber-400/60 animate-pulse transition-all"
                          style={{
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`
                          }}
                          title={`Stop Verse: Surah ${box.sura}, Ayah ${box.ayah}`}
                        >
                          <div className="absolute -bottom-1 left-0 right-0 h-1 bg-amber-400 rounded-full shadow-md" />
                        </div>
                      );
                    }

                    if (isWithinExamRange) {
                      return (
                        <div
                          key={`ikhtebaar-range-${box.global_id}-${idx}`}
                          className="absolute z-10 rounded-md bg-amber-500/10 border border-amber-500/30 transition-all"
                          style={{
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`
                          }}
                          title={`Tested Passage: Surah ${box.sura}, Ayah ${box.ayah}`}
                        />
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </div>

            {/* Modal Bottom Footer with Dual-Anchor Legend */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-amber-50/40 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-mono">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span>Start Verse</span>
                </span>
                <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>Stop Verse</span>
                </span>
                <span className="flex items-center gap-1.5 text-amber-200/60">
                  <span className="w-2 h-2 rounded bg-amber-500/30 border border-amber-500/50" />
                  <span>Exam Span</span>
                </span>
              </div>
              <span>Use Left/Right Arrow Keys to browse pages</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IkhtebaarTab;
