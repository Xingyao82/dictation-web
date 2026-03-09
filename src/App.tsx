import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import './App.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Play,
  CheckCircle2,
  XCircle,
  SkipForward,
  RotateCcw,
  Upload,
  Volume2,
  BookOpen,
  Trophy,
  Shuffle,
  Sparkles,
} from 'lucide-react'

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

  const [wordProgress, setWordProgress] = useState<Record<string, WordProgress>>({})
  const [roundWrongWords, setRoundWrongWords] = useState<string[]>([])
  const [reviewRound, setReviewRound] = useState(0)

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechRate, setSpeechRate] = useState(0.8)
  const [dedupeWords, setDedupeWords] = useState(true)
  const [shuffleWordsEnabled, setShuffleWordsEnabled] = useState(false)
  const synthRef = useRef<SpeechSynthesis | null>(null)

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
      if (!synthRef.current || !word) return

      synthRef.current.cancel()

      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = /^[\u4e00-\u9fa5]/.test(word) ? 'zh-CN' : 'en-US'
      utterance.rate = speechRate
      utterance.pitch = 1

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)

      synthRef.current.speak(utterance)
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
        mastered: prev[wordKey]?.mastered || isCorrect,
      },
    }))

    if (isCorrect) {
      moveToNext()
      return
    }

    if (!roundWrongWords.includes(currentWord)) {
      setRoundWrongWords((prev) => [...prev, currentWord])
    }
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
  }

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
  const currentCorrect = currentWord
    ? normalizeWord(userInput) === normalizeWord(currentWord)
    : false

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-indigo-900 flex items-center justify-center gap-3">
            <BookOpen className="w-8 h-8 md:w-10 md:h-10" />
            单词听写助手
          </h1>
          <p className="text-indigo-600 mt-2">输入单词，开始听写练习</p>
        </div>

        {appState === 'input' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5" />
                输入单词列表
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="请输入要听写的单词，可以用空格、逗号或换行分隔...&#10;例如：apple banana orange"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="min-h-[150px] resize-none"
              />

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" className="gap-2" asChild>
                    <span>
                      <Upload className="w-4 h-4" />
                      上传文本文件
                    </span>
                  </Button>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">语速:</span>
                  <select
                    value={speechRate}
                    onChange={(e) => setSpeechRate(Number(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value={0.5}>慢速</option>
                    <option value={0.8}>中速</option>
                    <option value={1}>正常</option>
                    <option value={1.2}>快速</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={dedupeWords} onChange={(e) => setDedupeWords(e.target.checked)} />
                  自动去重
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={shuffleWordsEnabled}
                    onChange={(e) => setShuffleWordsEnabled(e.target.checked)}
                  />
                  随机顺序
                </label>
              </div>

              {inputText && (
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  共 <Badge variant="secondary">{parseWords(inputText).length}</Badge> 个单词
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="w-3 h-3" />
                    自动保存输入
                  </Badge>
                </div>
              )}

              <Button onClick={startDictation} disabled={!inputText.trim()} className="w-full gap-2" size="lg">
                {shuffleWordsEnabled ? <Shuffle className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                开始听写
              </Button>
            </CardContent>
          </Card>
        )}

        {(appState === 'listening' || appState === 'checking') && (
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Volume2 className={`w-5 h-5 ${isSpeaking ? 'animate-pulse text-indigo-600' : ''}`} />
                  听写中
                  {reviewRound > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      复习第 {reviewRound} 轮
                    </Badge>
                  )}
                </CardTitle>
                <div className="text-sm text-gray-600">
                  {currentIndex + 1} / {words.length}
                </div>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="flex justify-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{masteredCount}</div>
                  <div className="text-xs text-gray-500">已掌握</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{roundWrongWords.length}</div>
                  <div className="text-xs text-gray-500">本轮错题</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{baseWords.length}</div>
                  <div className="text-xs text-gray-500">总计</div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button variant="outline" onClick={replayWord} disabled={isSpeaking} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  {isSpeaking ? '播放中...' : '重播单词'}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">请输入你听到的单词：</label>
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="在此输入单词..."
                  className={`text-lg text-center py-6 ${
                    appState === 'checking'
                      ? currentCorrect
                        ? 'border-green-500 bg-green-50'
                        : 'border-red-500 bg-red-50'
                      : ''
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && appState === 'listening') checkAnswer()
                    if (e.key === ' ' && appState === 'listening') {
                      e.preventDefault()
                      replayWord()
                    }
                  }}
                  autoFocus
                />
                {appState === 'checking' && (
                  <div className={`text-center text-sm ${currentCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {currentCorrect ? '✓ 回答正确！' : `✗ 正确答案是：${currentWord}`}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {appState === 'listening' ? (
                  <>
                    <Button
                      onClick={checkAnswer}
                      disabled={!userInput.trim()}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      确认核对
                    </Button>
                    <Button onClick={handleDontKnow} variant="destructive" className="gap-2">
                      <XCircle className="w-4 h-4" />
                      我不会
                    </Button>
                    <Button onClick={moveToNext} variant="outline" className="gap-2">
                      <SkipForward className="w-4 h-4" />
                      下一个
                    </Button>
                  </>
                ) : (
                  <Button onClick={moveToNext} className="col-span-3 gap-2" variant={currentCorrect ? 'default' : 'secondary'}>
                    <SkipForward className="w-4 h-4" />
                    {currentCorrect ? '继续下一个' : '记下了，下一个'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {appState === 'completed' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-center text-2xl flex items-center justify-center gap-2">
                <Trophy className="w-8 h-8 text-yellow-500" />
                听写完成！
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-indigo-50 rounded-lg p-6">
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold text-indigo-600">
                    {baseWords.length > 0 ? Math.round((masteredCount / baseWords.length) * 100) : 0}%
                  </div>
                  <div className="text-gray-600 mt-1">正确率</div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl font-semibold text-green-600">{masteredCount}</div>
                    <div className="text-xs text-gray-500">掌握单词</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-red-600">{baseWords.length - masteredCount}</div>
                    <div className="text-xs text-gray-500">需加强</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-indigo-600">{baseWords.length}</div>
                    <div className="text-xs text-gray-500">总单词数</div>
                  </div>
                </div>
              </div>

              {wrongWordsFinal.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">需要加强的单词：</h3>
                  <div className="flex flex-wrap gap-2">
                    {wrongWordsFinal.map((word, i) => (
                      <Badge key={`${word}-${i}`} variant="destructive" className="text-sm py-1 px-3">
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={restart} className="w-full gap-2" size="lg">
                <RotateCcw className="w-5 h-5" />
                重新开始
              </Button>
            </CardContent>
          </Card>
        )}

        {appState === 'input' && (
          <Card className="mt-6 shadow">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-gray-700 mb-3">优化后使用说明：</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>支持粘贴 / 上传 .txt，一键导入单词</li>
                <li>可选自动去重、随机顺序，更接近真实记忆场景</li>
                <li>输入内容和语速会自动保存，下次打开无需重填</li>
                <li>Enter 直接核对，空格快速重播（听写时）</li>
                <li>答错单词自动进入复习循环，最多复习 2 轮</li>
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default App
