import { useState, useRef, useEffect, useCallback } from 'react'
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
  Trophy
} from 'lucide-react'

interface WordStats {
  word: string
  correct: boolean
  attempts: number
}

type AppState = 'input' | 'listening' | 'checking' | 'completed'

function App() {
  // 输入相关状态
  const [inputText, setInputText] = useState('')
  const [words, setWords] = useState<string[]>([])
  
  // 听写状态
  const [appState, setAppState] = useState<AppState>('input')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userInput, setUserInput] = useState('')
  
  // 统计信息
  const [masteredCount, setMasteredCount] = useState(0)
  const [wordStats, setWordStats] = useState<WordStats[]>([])
  const [wrongWords, setWrongWords] = useState<string[]>([])
  const [reviewRound, setReviewRound] = useState(0)
  
  // 语音相关
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechRate, setSpeechRate] = useState(0.8)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  // 初始化语音合成
  useEffect(() => {
    synthRef.current = window.speechSynthesis
  }, [])

  // 解析输入文本
  const parseWords = (text: string): string[] => {
    return text
      .split(/[\s,，\.。;；!！?？\n]+/)
      .map(w => w.trim())
      .filter(w => w.length > 0)
  }

  // 开始听写
  const startDictation = () => {
    const parsedWords = parseWords(inputText)
    if (parsedWords.length === 0) return
    
    setWords(parsedWords)
    setWordStats(parsedWords.map(w => ({ word: w, correct: false, attempts: 0 })))
    setCurrentIndex(0)
    setMasteredCount(0)
    setWrongWords([])
    setReviewRound(0)
    setAppState('listening')
    setUserInput('')
    
    // 延迟后开始播报第一个单词
    setTimeout(() => {
      speakWord(parsedWords[0])
    }, 500)
  }

  // 语音播报
  const speakWord = useCallback((word: string) => {
    if (!synthRef.current || !word) return
    
    // 取消之前的语音
    synthRef.current.cancel()
    
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = /^[\u4e00-\u9fa5]/.test(word) ? 'zh-CN' : 'en-US'
    utterance.rate = speechRate
    utterance.pitch = 1
    
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    
    synthRef.current.speak(utterance)
  }, [speechRate])

  // 重播当前单词
  const replayWord = () => {
    if (words[currentIndex]) {
      speakWord(words[currentIndex])
    }
  }

  // 确认核对
  const checkAnswer = () => {
    const currentWord = words[currentIndex]
    const isCorrect = userInput.trim().toLowerCase() === currentWord.trim().toLowerCase()
    
    // 更新统计
    setWordStats(prev => {
      const newStats = [...prev]
      const statIndex = words.indexOf(currentWord)
      if (statIndex >= 0) {
        newStats[statIndex].attempts++
        if (isCorrect) {
          newStats[statIndex].correct = true
        }
      }
      return newStats
    })

    if (isCorrect) {
      // 正确：增加掌握计数
      setMasteredCount(prev => prev + 1)
      moveToNext()
    } else {
      // 错误：加入错题本
      if (!wrongWords.includes(currentWord)) {
        setWrongWords(prev => [...prev, currentWord])
      }
      // 显示错误状态，让用户选择
      setAppState('checking')
    }
  }

  // 我不会
  const handleDontKnow = () => {
    const currentWord = words[currentIndex]
    
    // 加入错题本
    if (!wrongWords.includes(currentWord)) {
      setWrongWords(prev => [...prev, currentWord])
    }
    
    // 显示正确答案
    setUserInput(currentWord)
    setAppState('checking')
  }

  // 下一个
  const moveToNext = () => {
    const nextIndex = currentIndex + 1
    
    if (nextIndex >= words.length) {
      // 一轮结束，检查是否有错题需要复习
      if (wrongWords.length > 0 && reviewRound < 2) {
        // 进入复习模式
        setReviewRound(prev => prev + 1)
        const newWords = [...wrongWords]
        setWords(newWords)
        setCurrentIndex(0)
        setWrongWords([])
        setUserInput('')
        setAppState('listening')
        
        setTimeout(() => {
          speakWord(newWords[0])
        }, 500)
      } else {
        // 全部完成
        setAppState('completed')
      }
    } else {
      // 继续下一个
      setCurrentIndex(nextIndex)
      setUserInput('')
      setAppState('listening')
      
      setTimeout(() => {
        speakWord(words[nextIndex])
      }, 300)
    }
  }

  // 重新开始
  const restart = () => {
    setAppState('input')
    setInputText('')
    setWords([])
    setCurrentIndex(0)
    setMasteredCount(0)
    setWordStats([])
    setWrongWords([])
    setReviewRound(0)
    setUserInput('')
  }

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setInputText(prev => prev ? prev + '\n' + text : text)
    }
    reader.readAsText(file)
  }

  // 进度百分比
  const progressPercent = words.length > 0 
    ? Math.round(((currentIndex + (appState === 'checking' ? 1 : 0)) / words.length) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-indigo-900 flex items-center justify-center gap-3">
            <BookOpen className="w-8 h-8 md:w-10 md:h-10" />
            单词听写助手
          </h1>
          <p className="text-indigo-600 mt-2">输入单词，开始听写练习</p>
        </div>

        {/* 输入阶段 */}
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
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
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
              </div>

              {inputText && (
                <div className="text-sm text-gray-600">
                  共 <Badge variant="secondary">{parseWords(inputText).length}</Badge> 个单词
                </div>
              )}

              <Button 
                onClick={startDictation}
                disabled={!inputText.trim()}
                className="w-full gap-2"
                size="lg"
              >
                <Play className="w-5 h-5" />
                开始听写
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 听写阶段 */}
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
              {/* 统计信息 */}
              <div className="flex justify-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{masteredCount}</div>
                  <div className="text-xs text-gray-500">已掌握</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{wrongWords.length}</div>
                  <div className="text-xs text-gray-500">待复习</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {masteredCount + wrongWords.length}
                  </div>
                  <div className="text-xs text-gray-500">总计</div>
                </div>
              </div>

              {/* 重播按钮 */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={replayWord}
                  disabled={isSpeaking}
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {isSpeaking ? '播放中...' : '重播单词'}
                </Button>
              </div>

              {/* 输入框 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  请输入你听到的单词：
                </label>
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="在此输入单词..."
                  className={`text-lg text-center py-6 ${
                    appState === 'checking' 
                      ? wordStats.find(s => s.word === words[currentIndex])?.correct
                        ? 'border-green-500 bg-green-50'
                        : 'border-red-500 bg-red-50'
                      : ''
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && appState === 'listening') {
                      checkAnswer()
                    }
                  }}
                  autoFocus
                />
                {appState === 'checking' && (
                  <div className={`text-center text-sm ${
                    wordStats.find(s => s.word === words[currentIndex])?.correct
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {wordStats.find(s => s.word === words[currentIndex])?.correct
                      ? '✓ 回答正确！'
                      : `✗ 正确答案是：${words[currentIndex]}`}
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
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
                    <Button
                      onClick={handleDontKnow}
                      variant="destructive"
                      className="gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      我不会
                    </Button>
                    <Button
                      onClick={moveToNext}
                      variant="outline"
                      className="gap-2"
                    >
                      <SkipForward className="w-4 h-4" />
                      下一个
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={moveToNext}
                    className="col-span-3 gap-2"
                    variant={wordStats.find(s => s.word === words[currentIndex])?.correct ? 'default' : 'secondary'}
                  >
                    <SkipForward className="w-4 h-4" />
                    {wordStats.find(s => s.word === words[currentIndex])?.correct ? '继续下一个' : '记下了，下一个'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 完成阶段 */}
        {appState === 'completed' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-center text-2xl flex items-center justify-center gap-2">
                <Trophy className="w-8 h-8 text-yellow-500" />
                听写完成！
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 成绩统计 */}
              <div className="bg-indigo-50 rounded-lg p-6">
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold text-indigo-600">
                    {Math.round((masteredCount / wordStats.length) * 100)}%
                  </div>
                  <div className="text-gray-600 mt-1">正确率</div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl font-semibold text-green-600">{masteredCount}</div>
                    <div className="text-xs text-gray-500">掌握单词</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-red-600">
                      {wordStats.length - masteredCount}
                    </div>
                    <div className="text-xs text-gray-500">需加强</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-indigo-600">
                      {wordStats.length}
                    </div>
                    <div className="text-xs text-gray-500">总单词数</div>
                  </div>
                </div>
              </div>

              {/* 错题列表 */}
              {wordStats.filter(s => !s.correct).length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">需要加强的单词：</h3>
                  <div className="flex flex-wrap gap-2">
                    {wordStats
                      .filter(s => !s.correct)
                      .map((s, i) => (
                        <Badge key={i} variant="destructive" className="text-sm py-1 px-3">
                          {s.word}
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

        {/* 使用说明 */}
        {appState === 'input' && (
          <Card className="mt-6 shadow">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-gray-700 mb-3">使用说明：</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>在上方输入框中输入要听写的单词（支持中英文）</li>
                <li>也可以上传 .txt 文本文件批量导入</li>
                <li>点击"开始听写"，系统会语音播报单词</li>
                <li>听到单词后，在输入框中输入你听到的内容</li>
                <li>点击"确认核对"检查答案，或点击"我不会"查看正确答案</li>
                <li>答错的单词会自动进入复习循环，最多复习2轮</li>
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default App
