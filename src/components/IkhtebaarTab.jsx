import React, { useState, useEffect, useRef } from 'react';
import { Award, HelpCircle, ChevronDown, ChevronUp, Mic, MicOff, RefreshCw, CheckCircle2, AlertCircle, Sparkles, Zap, Shield, Flame, BookOpen } from 'lucide-react';
import { getJuzPageRange, JUZ_LIST, SURAH_LIST } from '../utils/juzMapping';
import { BatchAudioRecorder } from '../utils/audioRecorder';
import { AudioVisualizer } from './AudioVisualizer';

export const IkhtebaarTab = () => {
  // Config States
  const [rangeMode, setRangeMode] = useState('juz'); // 'juz' | 'page' | 'surah'
  const [selectedJuz, setSelectedJuz] = useState(1);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(21);
  const [startSurah, setStartSurah] = useState(1);
  const [endSurah, setEndSurah] = useState(1);
  const [difficulty, setDifficulty] = useState('medium'); // 'easy' | 'medium' | 'hard'

  // Exam Question State
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [excludedQuestions, setExcludedQuestions] = useState([]);

  // Accordion Hint Toggles
  const [activeHint, setActiveHint] = useState(null); // 'hint_1' | 'hint_2' | 'hint_3' | null

  // Batch Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [analyserNode, setAnalyserNode] = useState(null);

  // Grade Evaluation Result
  const [gradeResult, setGradeResult] = useState(null);

  const recorderRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Apply exact Juz mapping math whenever Juz changes
  useEffect(() => {
    if (rangeMode === 'juz') {
      const range = getJuzPageRange(selectedJuz);
      setFromPage(range.startPage);
      setToPage(range.endPage);
    }
  }, [selectedJuz, rangeMode]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recorderRef.current) recorderRef.current.cleanup();
    };
  }, []);

  // Fetch AI Question from /api/generate_ikhtebaar
  const generateQuestion = async () => {
    setLoadingQuestion(true);
    setQuestionError('');
    setGradeResult(null);
    setActiveHint(null);

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

    const excludeParam = excludedQuestions.join(',');

    try {
      const url = `/api/generate_ikhtebaar?mode=${modeParam}&start_val=${startVal}&end_val=${endVal}&difficulty=${difficulty}&exclude=${excludeParam}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        setQuestionError(data.error);
        setCurrentQuestion(null);
      } else {
        setCurrentQuestion(data);
        if (data.question_id) {
          setExcludedQuestions(prev => [...prev, data.question_id]);
        }
      }
    } catch (err) {
      console.error("Generate Ikhtebaar error:", err);
      setQuestionError("Failed to fetch exam question from server.");
    } finally {
      setLoadingQuestion(false);
    }
  };

  // 1. INITIATE RECITATION (Batch Mode)
  const initiateRecitation = async () => {
    if (!currentQuestion) {
      alert("Please generate an exam question first.");
      return;
    }

    try {
      const recorder = new BatchAudioRecorder();
      recorderRef.current = recorder;

      await recorder.startRecording();
      setAnalyserNode(recorder.getAnalyser());
      setIsRecording(true);
      setGradeResult(null);
      setElapsedSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert(err.message || "Failed to start microphone recording.");
    }
  };

  // 2. CONCLUDE RECITATION & SEND AUDIO BLOB TO /transcribe_and_compare
  const concludeRecitation = async () => {
    if (!recorderRef.current || !isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    try {
      setIsRecording(false);
      setIsAnalyzing(true);

      const audioBlob = await recorderRef.current.stopRecording();

      const formData = new FormData();
      formData.append('file', audioBlob, 'ikhtebaar_recitation.wav');
      formData.append('expected_text', currentQuestion.expected_full_text);

      const response = await fetch('/transcribe_and_compare', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP status ${response.status}`);
      }

      const resultData = await response.json();
      setGradeResult(resultData);
    } catch (err) {
      console.error("Exam evaluation error:", err);
      alert("Failed to grade exam recitation: " + err.message);
    } finally {
      setIsAnalyzing(false);
      setAnalyserNode(null);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const matchCount = gradeResult?.comparison?.filter(c => c.status === 'match').length || 0;
  const mistakeCount = gradeResult?.comparison?.filter(c => c.status === 'mistake').length || 0;
  const totalWords = gradeResult?.comparison?.length || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Exam Configuration Header */}
      <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-gold-400" /> Academic Exam Configurator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Set exam boundaries and difficulty. Algorithm selects non-repeating testing passages.
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

        <div className="flex flex-wrap items-center justify-between gap-6">
          {/* Inputs */}
          <div className="flex flex-wrap items-center gap-6">
            {rangeMode === 'juz' && (
              <div className="flex items-center gap-4 min-w-[280px]">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Select Juz Module:</label>
                  <select
                    value={selectedJuz}
                    onChange={(e) => setSelectedJuz(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-900 text-gold-300 font-bold text-sm rounded-xl px-4 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                  >
                    {JUZ_LIST.map((j) => (
                      <option key={j.id} value={j.id}>{j.displayLabel}</option>
                    ))}
                  </select>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-gold-500/30 text-center">
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">Pages</span>
                  <span className="text-xs font-mono font-bold text-amber-400">{fromPage}-{toPage}</span>
                </div>
              </div>
            )}

            {rangeMode === 'page' && (
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">From Page:</label>
                  <input
                    type="number"
                    min={1}
                    max={604}
                    value={fromPage}
                    onChange={(e) => setFromPage(parseInt(e.target.value, 10))}
                    className="w-24 bg-slate-900 text-gold-300 font-bold text-sm rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
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
                    className="w-24 bg-slate-900 text-gold-300 font-bold text-sm rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {rangeMode === 'surah' && (
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Start Surah:</label>
                  <select
                    value={startSurah}
                    onChange={(e) => setStartSurah(parseInt(e.target.value, 10))}
                    className="bg-slate-900 text-slate-100 text-xs font-semibold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                  >
                    {SURAH_LIST.map((s) => <option key={s.id} value={s.id}>{s.id}. {s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">End Surah:</label>
                  <select
                    value={endSurah}
                    onChange={(e) => setEndSurah(parseInt(e.target.value, 10))}
                    className="bg-slate-900 text-slate-100 text-xs font-semibold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-500"
                  >
                    {SURAH_LIST.map((s) => <option key={s.id} value={s.id}>{s.id}. {s.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Difficulty Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Difficulty Tier:</label>
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setDifficulty('easy')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    difficulty === 'easy' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Easy
                </button>
                <button
                  onClick={() => setDifficulty('medium')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    difficulty === 'medium' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Medium
                </button>
                <button
                  onClick={() => setDifficulty('hard')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    difficulty === 'hard' ? 'bg-red-500 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Hard
                </button>
              </div>
            </div>
          </div>

          {/* Action Trigger Button */}
          <button
            onClick={generateQuestion}
            disabled={loadingQuestion}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-gold-glow transition-all disabled:opacity-50"
          >
            {loadingQuestion ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            <span>Generate Examination Question</span>
          </button>
        </div>
      </div>

      {/* 2. Active Exam Question Workspace & Progressive Hints */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Question Prompts & Hint Accordion */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-gold-500/20 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gold-400" /> Exam Question Card
            </h3>
            {currentQuestion && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-gold-300 border border-amber-500/30">
                Target Page #{currentQuestion.page_number}
              </span>
            )}
          </div>

          {loadingQuestion ? (
            <div className="py-20 text-center text-gold-400 text-xs font-semibold flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span>Generating random academic test question...</span>
            </div>
          ) : questionError ? (
            <div className="p-8 text-center text-red-400 text-xs font-semibold space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto" />
              <p>{questionError}</p>
            </div>
          ) : currentQuestion ? (
            <div className="space-y-6">
              {/* Start Prompt Card */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                  <span>1. START RECITING FROM THIS AYAH:</span>
                  <span className="font-arabic">بداية الآية</span>
                </div>
                <div className="text-right leading-loose font-arabic text-2xl text-amber-100 pt-1">
                  {currentQuestion.start_text}
                </div>
              </div>

              {/* Stop Target Card */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span>2. CONTINUE RECITING UNTIL THIS END AYAH:</span>
                  <span className="font-arabic">نهاية الآية</span>
                </div>
                <div className="text-right leading-loose font-arabic text-2xl text-emerald-100 pt-1">
                  {currentQuestion.stop_text}
                </div>
              </div>

              {/* Progressive Hints Accordion */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-gold-400" /> Progressive Academic Hints
                </h4>

                {/* Hint 1 */}
                <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all">
                  <button
                    onClick={() => setActiveHint(activeHint === 'hint_1' ? null : 'hint_1')}
                    className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-900"
                  >
                    <span className="text-xs font-semibold text-slate-200">
                      Hint 1: First Ayah on Target Page {currentQuestion.page_number}
                    </span>
                    {activeHint === 'hint_1' ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {activeHint === 'hint_1' && (
                    <div className="p-4 bg-slate-950 border-t border-slate-800 text-right font-arabic text-xl text-amber-200">
                      {currentQuestion.hint_1}
                    </div>
                  )}
                </div>

                {/* Hint 2 */}
                <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all">
                  <button
                    onClick={() => setActiveHint(activeHint === 'hint_2' ? null : 'hint_2')}
                    className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-900"
                  >
                    <span className="text-xs font-semibold text-slate-200">
                      Hint 2: Surah Identification
                    </span>
                    {activeHint === 'hint_2' ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {activeHint === 'hint_2' && (
                    <div className="p-4 bg-slate-950 border-t border-slate-800 text-left text-xs font-semibold text-amber-300">
                      {currentQuestion.hint_2}
                    </div>
                  )}
                </div>

                {/* Hint 3 */}
                <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all">
                  <button
                    onClick={() => setActiveHint(activeHint === 'hint_3' ? null : 'hint_3')}
                    className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-900"
                  >
                    <span className="text-xs font-semibold text-slate-200">
                      Hint 3: Preceding Ayah Passage Text
                    </span>
                    {activeHint === 'hint_3' ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>
                  {activeHint === 'hint_3' && (
                    <div className="p-4 bg-slate-950 border-t border-slate-800 text-right font-arabic text-xl text-amber-200">
                      {currentQuestion.hint_3}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400 text-xs space-y-2">
              <Award className="w-10 h-10 mx-auto text-slate-600" />
              <p>Click <strong>"Generate Examination Question"</strong> to start an oral Quran testing session.</p>
            </div>
          )}
        </div>

        {/* Right Column: Batch Recording & Controls */}
        <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/30 shadow-xl flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-gold-400" /> Oral Examination Reciter
              </h3>
              {isRecording && (
                <span className="font-mono text-xs font-bold text-red-400 bg-red-950 px-2 py-0.5 rounded border border-red-800 animate-pulse">
                  REC: {formatTime(elapsedSeconds)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Click <strong>"Initiate Recitation"</strong>, recite from the Start Ayah to Stop Ayah, then click <strong>"Conclude Recitation"</strong>.
            </p>
          </div>

          {/* Visualizer Canvas */}
          <AudioVisualizer analyser={analyserNode} isRecording={isRecording} className="h-32" />

          {/* Action Buttons */}
          <div className="space-y-3">
            {!isRecording && !isAnalyzing ? (
              <button
                onClick={initiateRecitation}
                disabled={!currentQuestion}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40"
              >
                <Mic className="w-5 h-5" />
                <span>Initiate Recitation</span>
              </button>
            ) : isRecording ? (
              <button
                onClick={concludeRecitation}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 animate-pulse transition-all"
              >
                <MicOff className="w-5 h-5" />
                <span>Conclude Recitation & Grade</span>
              </button>
            ) : (
              <div className="py-4 rounded-xl bg-slate-900 border border-gold-500/40 text-center text-gold-300 text-xs font-semibold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-gold-400" />
                <span>Evaluating recitation with Whisper AI...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Detailed Grade Report Card */}
      {gradeResult && (
        <div className="glass-panel-gold rounded-2xl p-6 border border-gold-500/40 shadow-2xl space-y-6 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-extrabold text-2xl flex items-center justify-center shadow-gold-glow">
                {gradeResult.score}%
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-100">Oral Exam Final Grade</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    gradeResult.score >= 85 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {gradeResult.score >= 90 ? 'Distinction Pass' : gradeResult.score >= 75 ? 'Passed' : 'Review Required'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Evaluated using AI batch audio verification against target test script.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Exam Words</span>
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

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Exam Recitation Breakdown (Green = Match, Red = Mistake)</span>
              <span className="text-gold-400 font-arabic text-sm">نتيجة الاختبار</span>
            </h4>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap flex-row-reverse gap-3 text-right leading-loose font-arabic text-2xl">
              {gradeResult.comparison?.map((item, idx) => {
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
    </div>
  );
};
