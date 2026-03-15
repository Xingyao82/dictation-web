import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import './App.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ArrowRight, BookOpen, CheckCircle2, Headphones, RotateCcw, Shuffle, SkipForward, Trophy, Upload, Volume2, Waves, XCircle } from 'lucide-react'

type AppState = 'input' | 'listening' | 'checking' | 'completed'

type WordProgress = {
  attempts: number
  mastered: boolean
}

const LS_INPUT_KEY = 'dictation_input_text'
const LS_RATE_KEY = 'dictation_speech_rate'

function normalizeWord(word: string) {
  return word.trim().toLowerCase()
}

function shuffleArray<T>(arr: T[]) {
  const next = [...arr]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function App() {
  const [inputText, setInputText] = useState('')
  const [words, setWords] = useState<string[]>([])
  const [baseWords, setBaseWords] = useState<string[]>([])

  const [appState, setAppState] = useState<AppState>('input')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [revealedByDontKnow, setRevealedByDontKnow] = useState(false)

  const [wordProgress, setWordProgress] = useState<Record<string, WordProgress>>({})
  const [roundWrongWords, setRoundWrongWords] = useState<string[]>([])
  const [reviewRound, setReviewRound] = useState(0)

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechRate, setSpeechRate] = useState(0.8)
  const [dedupeWords, setDedupeWords] = useState(true)
  const [shuffleWordsEnabled, setShuffleWordsEnabled] = useState(false)

  const synthRef = useRef<SpeechSynthesis | null>(null)
  const answerInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    synthRef.current = window.speechSynthesis

    const savedInput = localStorage.getItem(LS_INPUT_KEY)
    const savedRate = localStorage.getItem(LS_RATE_KEY)

    if (savedInput) setInputText(savedInput)
    if (savedRate) {
      const rate = Number(savedRate)
      if (!Number.isNaN(rate) && rate > 0) setSpeechRate(rate)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_INPUT_KEY, inputText)
  }, [inputText])

  useEffect(() => {
    localStorage.setItem(LS_RATE_KEY, String(speechRate))
  }, [speechRate])

  useEffect(() => {
    if (appState === 'listening' || appState === 'checking') {
      answerInputRef.current?.focus()
    }
  }, [appState, currentIndex])

  const parseWords = (text: string): string[] => {
    const parsed = text
      .split(/[\s,，\.。;；!！?？\n]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0)

    if (!dedupeWords) return parsed

    const seen = new Set<string>()
    return parsed.filter((word) => {
      const key = normalizeWord(word)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const speakWord = useCallback(
    (word: string) => {
      if (!synthRef.current || !word || !('speechSynthesis' in window)) return

      const synth = synthRef.current
      const targetLang = /^[\u4e00-\u9fa5]/.test(word) ? 'zh' : 'en'

      synth.cancel()
      synth.resume()

      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = targetLang === 'zh' ? 'zh-CN' : 'en-US'
      utterance.rate = speechRate
      utterance.pitch = 1

      const voices = synth.getVoices()
      const matchedVoice =
        voices.find((v) => v.lang?.toLowerCase().startsWith(utterance.lang.toLowerCase())) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith(targetLang))

      if (matchedVoice) utterance.voice = matchedVoice

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      setTimeout(() => synth.speak(utterance), 60)
    },
    [speechRate]
  )

  const startDictation = () => {
    const parsedWords = parseWords(inputText)
    if (parsedWords.length === 0) return

    const finalWords = shuffleWordsEnabled ? shuffleArray(parsedWords) : parsedWords

    const progressInit: Record<string, WordProgress> = {}
    for (const word of parsedWords) {
      progressInit[normalizeWord(word)] = { attempts: 0, mastered: false }
    }

    setBaseWords(parsedWords)
    setWords(finalWords)
    setWordProgress(progressInit)
    setCurrentIndex(0)
    setRoundWrongWords([])
    setReviewRound(0)
    setAppState('listening')
    setUserInput('')
    setRevealedByDontKnow(false)

    setTimeout(() => {
      speakWord(finalWords[0])
    }, 450)
  }

  const replayWord = () => {
    if (words[currentIndex]) speakWord(words[currentIndex])
  }

  const checkAnswer = () => {
    const currentWord = words[currentIndex]
    const wordKey = normalizeWord(currentWord)
    const isCorrect = normalizeWord(userInput) === wordKey

    setWordProgress((prev) => ({
      ...prev,
      [wordKey]: {
        attempts: (prev[wordKey]?.attempts ?? 0) + 1,
        mastered: (prev[wordKey]?.mastered ?? false) || isCorrect,
      },
    }))

    if (isCorrect) {
      setRevealedByDontKnow(false)
      moveToNext()
      return
    }

    if (!roundWrongWords.includes(currentWord)) {
      setRoundWrongWords((prev) => [...prev, currentWord])
    }
    setRevealedByDontKnow(false)
    setAppState('checking')
  }

  const handleDontKnow = () => {
    const currentWord = words[currentIndex]
    const wordKey = normalizeWord(currentWord)

    setWordProgress((prev) => ({
      ...prev,
      [wordKey]: {
        attempts: (prev[wordKey]?.attempts ?? 0) + 1,
        mastered: prev[wordKey]?.mastered ?? false,
      },
    }))

    if (!roundWrongWords.includes(currentWord)) {
      setRoundWrongWords((prev) => [...prev, currentWord])
    }

    setUserInput(currentWord)
    setRevealedByDontKnow(true)
    setAppState('checking')
  }

  const moveToNext = () => {
    const nextIndex = currentIndex + 1

    if (nextIndex >= words.length) {
      if (roundWrongWords.length > 0 && reviewRound < 2) {
        setReviewRound((prev) => prev + 1)
        const reviewWords = shuffleWordsEnabled ? shuffleArray(roundWrongWords) : [...roundWrongWords]
        setWords(reviewWords)
        setCurrentIndex(0)
        setRoundWrongWords([])
        setUserInput('')
        setRevealedByDontKnow(false)
        setAppState('listening')

        setTimeout(() => {
          speakWord(reviewWords[0])
        }, 450)
      } else {
        setAppState('completed')
      }
      return
    }

    setCurrentIndex(nextIndex)
    setUserInput('')
    setRevealedByDontKnow(false)
    setAppState('listening')

    setTimeout(() => {
      speakWord(words[nextIndex])
    }, 280)
  }

  const restart = () => {
    setAppState('input')
    setWords([])
    setBaseWords([])
    setCurrentIndex(0)
    setWordProgress({})
    setRoundWrongWords([])
    setReviewRound(0)
    setUserInput('')
    setRevealedByDontKnow(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setInputText((prev) => (prev ? prev + '\n' + text : text))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const parsedWordCount = useMemo(() => parseWords(inputText).length, [inputText, dedupeWords])

  const masteredCount = useMemo(
    () => Object.values(wordProgress).filter((w) => w.mastered).length,
    [wordProgress]
  )

  const wrongWordsFinal = useMemo(
    () => baseWords.filter((w) => !wordProgress[normalizeWord(w)]?.mastered),
    [baseWords, wordProgress]
  )

  const progressPercent =
    words.length > 0
      ? Math.round(((currentIndex + (appState === 'checking' ? 1 : 0)) / words.length) * 100)
      : 0

  const currentWord = words[currentIndex] || ''
  const currentCorrect = currentWord ? normalizeWord(userInput) === normalizeWord(currentWord) : false
  const showCorrectLabel = currentCorrect && !revealedByDontKnow
  const accuracy = baseWords.length > 0 ? Math.round((masteredCount / baseWords.length) * 100) : 0

  return (
    <div className="dictation-shell">
      <div className="dictation-glow dictation-glow-left" />
      <div className="dictation-glow dictation-glow-right" />

      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="premium-nav">
          <div className="flex items-center gap-3">
            <div className="premium-mark">
              <Waves className="h-4 w-4" />
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-6 pb-8 pt-6">
          <div className="space-y-6">

            {appState === 'input' && (
              <Card className="premium-panel border-white/10 bg-[#111823]/80 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur">
                <CardHeader className="gap-3 border-b border-white/10">
                  <CardTitle className="flex items-center gap-2 text-xl text-[#f7f1e3]">
                    <BookOpen className="h-5 w-5 text-[#d4a867]" />
                    准备单词列表
                  </CardTitle>
                  <CardDescription className="text-[#c8c2b7]">
                    支持空格、逗号、换行混合分隔。你也可以上传一个 `.txt` 文件接着编辑。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <Textarea
                    placeholder="例如：apple, balcony, delicate, memory, precise"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="min-h-[220px] resize-y border-white/10 bg-[#0b1119] text-base text-[#f7f1e3] placeholder:text-[#7e8795]"
                  />

                  <div className="grid gap-4 xl:grid-cols-[auto_auto_1fr]">
                    <label className="inline-flex cursor-pointer items-center">
                      <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
                      <Button
                        variant="outline"
                        className="h-11 gap-2 border-white/15 bg-white/5 px-4 text-[#f7f1e3] hover:bg-white/10"
                        asChild
                      >
                        <span>
                          <Upload className="h-4 w-4" />
                          导入文本
                        </span>
                      </Button>
                    </label>

                    <label className="setting-chip">
                      <span>语速</span>
                      <select
                        value={speechRate}
                        onChange={(e) => setSpeechRate(Number(e.target.value))}
                        className="setting-select"
                      >
                        <option value={0.5}>0.5x 慢速</option>
                        <option value={0.8}>0.8x 中速</option>
                        <option value={1}>1.0x 正常</option>
                        <option value={1.2}>1.2x 快速</option>
                      </select>
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <label className="toggle-chip">
                        <input type="checkbox" checked={dedupeWords} onChange={(e) => setDedupeWords(e.target.checked)} />
                        <span>自动去重</span>
                      </label>
                      <label className="toggle-chip">
                        <input
                          type="checkbox"
                          checked={shuffleWordsEnabled}
                          onChange={(e) => setShuffleWordsEnabled(e.target.checked)}
                        />
                        <span>随机顺序</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[#c8c2b7]">
                      <Badge className="premium-count border border-[#d4a867]/30 bg-[#d4a867]/10 text-[#f2d5a5]">
                        {parsedWordCount} 个单词
                      </Badge>
                      <Badge className="premium-count border border-white/10 bg-white/5 text-[#c8c2b7]">
                        自动保存已开启
                      </Badge>
                    </div>
                    <Button
                      onClick={startDictation}
                      disabled={!inputText.trim()}
                      className="h-11 min-w-[180px] gap-2 rounded-full bg-[#d4a867] px-5 text-[#1a1f18] hover:bg-[#e0b97f]"
                    >
                      {shuffleWordsEnabled ? <Shuffle className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                      开始听写
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {(appState === 'listening' || appState === 'checking') && (
              <Card className="premium-panel border-white/10 bg-[#111823]/82 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur">
                <CardHeader className="gap-4 border-b border-white/10">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-2xl text-[#f7f1e3]">
                        <Volume2 className={`h-5 w-5 text-[#d4a867] ${isSpeaking ? 'speaking-indicator' : ''}`} />
                        正在听写
                      </CardTitle>
                      <CardDescription className="mt-2 text-[#c8c2b7]">
                        Enter 核对答案，空格重播当前单词。
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {reviewRound > 0 && (
                        <Badge className="premium-badge border border-[#d4a867]/30 bg-[#d4a867]/10 text-[#f2d5a5]">
                          复习第 {reviewRound} 轮
                        </Badge>
                      )}
                      <Badge className="premium-badge border border-white/10 bg-white/5 text-[#f4ecdc]">
                        {currentIndex + 1} / {words.length}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={progressPercent} className="h-2.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#d4a867]" />
                </CardHeader>

                <CardContent className="space-y-6 pt-6">
                  <div className="listening-stage">
                    <button
                      type="button"
                      onClick={replayWord}
                      disabled={isSpeaking}
                      className={`speaker-button ${isSpeaking ? 'speaker-button-active' : ''}`}
                    >
                      <div className="speaker-rings" aria-hidden="true">
                        <span />
                        <span />
                      </div>
                      <Volume2 className="relative z-10 h-8 w-8" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <Input
                      ref={answerInputRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="在这里输入单词"
                      className={`h-14 border-white/10 bg-[#0b1119] px-5 text-center text-lg text-[#f7f1e3] placeholder:text-[#7e8795] ${
                        appState === 'checking'
                          ? showCorrectLabel
                            ? 'border-emerald-500/60 bg-emerald-500/10'
                            : 'border-rose-500/60 bg-rose-500/10'
                          : ''
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && appState === 'listening') checkAnswer()
                        if (e.key === ' ' && appState === 'listening') {
                          e.preventDefault()
                          replayWord()
                        }
                      }}
                    />

                    {appState === 'checking' && (
                      <div className={`answer-feedback ${showCorrectLabel ? 'answer-feedback-success' : 'answer-feedback-error'}`}>
                        {showCorrectLabel ? '回答正确，继续下一题。' : `正确答案：${currentWord}`}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {appState === 'listening' ? (
                      <>
                        <Button
                          onClick={checkAnswer}
                          disabled={!userInput.trim()}
                          className="h-11 gap-2 rounded-full bg-[#d4a867] text-[#1a1f18] hover:bg-[#e0b97f]"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          确认核对
                        </Button>
                        <Button
                          onClick={handleDontKnow}
                          variant="outline"
                          className="h-11 gap-2 rounded-full border-rose-400/30 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20"
                        >
                          <XCircle className="h-4 w-4" />
                          我不会
                        </Button>
                        <Button
                          onClick={moveToNext}
                          variant="outline"
                          className="h-11 gap-2 rounded-full border-white/10 bg-white/5 text-[#f4ecdc] hover:bg-white/10"
                        >
                          <SkipForward className="h-4 w-4" />
                          跳过
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={moveToNext}
                        className="h-11 gap-2 rounded-full bg-[#d4a867] text-[#1a1f18] hover:bg-[#e0b97f] sm:col-span-3"
                      >
                        <ArrowRight className="h-4 w-4" />
                        {showCorrectLabel ? '继续下一个' : '记下了，继续'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {appState === 'completed' && (
              <Card className="premium-panel border-white/10 bg-[#111823]/82 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur">
                <CardHeader className="gap-3 border-b border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-2xl text-[#f7f1e3]">
                        <Trophy className="h-6 w-6 text-[#d4a867]" />
                        听写完成
                      </CardTitle>
                    </div>
                    <Badge className="premium-badge border border-[#d4a867]/30 bg-[#d4a867]/10 text-[#f2d5a5]">
                      {accuracy}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="result-grid">
                    <div className="result-score">
                      <span>正确率</span>
                      <strong>{accuracy}%</strong>
                    </div>
                    <div className="session-stat">
                      <span>掌握单词</span>
                      <strong>{masteredCount}</strong>
                    </div>
                    <div className="session-stat">
                      <span>需加强</span>
                      <strong>{baseWords.length - masteredCount}</strong>
                    </div>
                  </div>

                  {wrongWordsFinal.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {wrongWordsFinal.map((word, i) => (
                          <Badge
                            key={`${word}-${i}`}
                            className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-rose-100"
                          >
                            {word}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm text-emerald-50">
                      全部掌握，没有留下错题。
                    </div>
                  )}

                  <Button
                    onClick={restart}
                    className="h-11 w-full gap-2 rounded-full bg-[#d4a867] text-[#1a1f18] hover:bg-[#e0b97f]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    重新开始
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

        </section>
      </main>
    </div>
  )
}

export default App
