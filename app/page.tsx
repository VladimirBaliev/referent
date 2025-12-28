'use client'

import { useState, useRef, useEffect } from 'react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

type ActionType = 'summary' | 'thesis' | 'telegram' | null

interface ParsedArticle {
  date: string | null
  title: string
  content: string
}

interface CachedResult {
  result: string
  timestamp: number
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [activeAction, setActiveAction] = useState<ActionType>(null)
  const [parsedArticle, setParsedArticle] = useState<ParsedArticle | null>(null)
  // Кэш результатов для каждого типа действия
  const [resultsCache, setResultsCache] = useState<Record<string, CachedResult>>({})
  // Состояние для ошибки валидации URL
  const [urlError, setUrlError] = useState<string>('')
  // Состояние для ошибки парсинга
  const [parseError, setParseError] = useState<{ message: string; type?: string } | null>(null)
  // Отдельное состояние для переведенного текста
  const [translatedText, setTranslatedText] = useState<string>('')
  // Состояние для отслеживания завершения парсинга и перевода
  const [isReady, setIsReady] = useState(false)
  // Флаг для предотвращения срабатывания onBlur при клике на кнопки
  const [isButtonClick, setIsButtonClick] = useState(false)
  // Состояние для уведомления о копировании
  const [copied, setCopied] = useState(false)
  // Ref для блока результатов для автоматической прокрутки
  const resultRef = useRef<HTMLDivElement>(null)

  // Функция для создания уникального ключа кэша
  const getCacheKey = (article: ParsedArticle, action: ActionType): string => {
    // Используем URL, заголовок и первые 100 символов контента для уникальности
    const contentHash = article.content.substring(0, 100).replace(/\s+/g, ' ').trim()
    return `${url}_${article.title}_${contentHash}_${action}`
  }

  // Функция для полной очистки всех состояний
  const handleClear = () => {
    setUrl('')
    setResult('')
    setParsedArticle(null)
    setTranslatedText('')
    setResultsCache({})
    setActiveAction(null)
    setUrlError('')
    setParseError(null)
    setIsReady(false)
    setCopied(false)
  }

  // Функция для копирования результата в буфер обмена
  const handleCopy = async () => {
    if (!result) return
    
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Ошибка при копировании:', err)
    }
  }

  // Автоматическая прокрутка к результатам после успешной генерации
  useEffect(() => {
    if (result && !loading && !result.startsWith('Ошибка:')) {
      // Небольшая задержка для завершения рендеринга
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [result, loading])

  const handleParse = async () => {
    // Предотвращаем повторный вызов, если уже выполняется парсинг
    if (loading) {
      return
    }

    // Не запускаем парсинг, если активна какая-то кнопка AI-обработки
    if (activeAction) {
      return
    }

    // Валидация URL
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setUrlError('Пожалуйста, введите URL статьи')
      return
    }

    // Проверка формата URL
    let isValidUrl = false
    try {
      new URL(trimmedUrl)
      isValidUrl = true
      setUrlError('')
    } catch {
      setUrlError('Введите корректный URL (например, https://example.com/article)')
      return
    }

    // Не запускаем парсинг, если URL не валидный
    if (!isValidUrl) {
      return
    }

    setLoading(true)
    setActiveAction(null)
    setResult('')
    setTranslatedText('') // Очищаем переведенный текст
    setIsReady(false) // Статья еще не готова
    setUrlError('')
    setParseError(null) // Очищаем ошибки парсинга
    // Очищаем кэш при парсинге новой статьи
    setResultsCache({})
    setParsedArticle(null)

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        // Используем дружественное сообщение от сервера или стандартное
        const errorMessage = errorData.error || 'Не удалось загрузить статью по этой ссылке.'
        setParseError({ message: errorMessage, type: errorData.errorType || 'parse' })
        setResult('')
        setIsReady(false)
        setLoading(false)
        return
      }

      const data = await response.json()
      
      // Сохраняем распарсенные данные
      setParsedArticle(data)
      
      // Автоматически переводим статью после парсинга
      const textToTranslate = `Title: ${data.title}\n\n${data.content}`
      
      try {
        const translateResponse = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: textToTranslate }),
        })

        if (!translateResponse.ok) {
          const error = await translateResponse.json()
          throw new Error(error.error || 'Ошибка при переводе статьи')
        }

        const translateData = await translateResponse.json()
        // Сохраняем переведенный текст в отдельное состояние
        const translation = translateData.translation
        
        // Проверяем, что перевод получен и не пустой
        if (translation && typeof translation === 'string' && translation.trim().length > 0) {
          setTranslatedText(translation)
          // Отображаем переведенный текст в результате
          setResult(translation)
          // Статья готова для AI-обработки
          setIsReady(true)
        } else {
          // Если перевод пустой или не получен, показываем оригинальный текст с предупреждением
          const originalText = `Заголовок: ${data.title}\n\n${data.content}`
          setResult(`⚠️ Не удалось получить перевод. Оригинальный текст:\n\n${originalText}`)
          setTranslatedText('')
          setIsReady(true)
        }
      } catch (translateError) {
        // Если перевод не удался, показываем понятное сообщение об ошибке
        const errorMessage = translateError instanceof Error ? translateError.message : 'Неизвестная ошибка'
        
        // Определяем, является ли это ошибкой лимита запросов
        const isRateLimitError = errorMessage.includes('лимит') || errorMessage.includes('429') || errorMessage.includes('Too Many Requests')
        
        if (isRateLimitError) {
          // Для ошибки лимита показываем только сообщение, без оригинального текста
          setResult('')
          setParseError({ 
            message: 'Превышен лимит запросов к API. Пожалуйста, подождите немного и попробуйте снова.', 
            type: 'rate_limit' 
          })
        } else {
          // Для других ошибок показываем оригинальный текст с сообщением
          const originalText = `Заголовок: ${data.title}\n\n${data.content}`
          setResult(`⚠️ Ошибка при переводе: ${errorMessage}\n\nОригинальный текст (на английском):\n\n${originalText}`)
        }
        
        setTranslatedText('')
        console.error('Ошибка при переводе:', translateError)
        // Статья все равно готова для AI-обработки (даже без перевода)
        setIsReady(true)
      }
    } catch (error) {
      // Обработка сетевых ошибок и других исключений
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
      
      // Определяем тип ошибки
      let errorType = 'unknown'
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        errorType = 'network'
      } else if (errorMessage.includes('timeout') || errorMessage.includes('таймаут')) {
        errorType = 'timeout'
      }
      
      setParseError({ 
        message: 'Не удалось загрузить статью по этой ссылке.', 
        type: errorType 
      })
      setResult('')
      setIsReady(false)
    } finally {
      setLoading(false)
    }
  }


  const handleAction = async (action: ActionType) => {
    // Предотвращаем повторный вызов, если уже выполняется обработка
    if (loading) {
      return
    }

    // Проверка наличия action
    if (!action) {
      return
    }

    // Проверка наличия URL
    if (!url.trim()) {
      alert('Сначала введите URL статьи')
      return
    }

    // Проверка наличия распарсенных данных и готовности статьи
    if (!parsedArticle || !parsedArticle.content) {
      alert('Сначала распарсите статью, чтобы получить данные для обработки')
      return
    }

    if (!isReady) {
      alert('Дождитесь завершения парсинга и перевода статьи')
      return
    }

    // Проверяем кэш - если результат уже есть, показываем его без запроса
    const cacheKey = getCacheKey(parsedArticle, action)
    const cachedResult = resultsCache[cacheKey]
    
    if (cachedResult) {
      setActiveAction(action)
      setResult(cachedResult.result)
      return
    }

    // Очищаем предыдущий результат и устанавливаем состояние загрузки
    // Важно: сначала устанавливаем активное действие, затем loading, затем очищаем результат
    // Устанавливаем activeAction синхронно перед loading, чтобы индикатор парсинга не показывался
    setActiveAction(action)
    setResult('')
    setLoading(true)

    try {
      // Формируем текст для обработки (заголовок + контент)
      // Используем оригинальный текст из parsedArticle, а не переведенный
      const textToProcess = `Title: ${parsedArticle.title}\n\n${parsedArticle.content}`

      const response = await fetch('/api/ai-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: textToProcess,
          action: action,
          sourceUrl: url.trim() // Передаем URL источника для Telegram поста
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        // Используем сообщение об ошибке от сервера, если оно есть
        const errorMessage = error.error || 'Ошибка при обработке статьи'
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      // Отображаем результат
      if (data.result && typeof data.result === 'string') {
        // Убеждаемся, что результат не пустой и не является просто текстом статьи
        const resultText = data.result.trim()
        if (resultText.length > 0) {
          // Обновляем результат сразу
          setResult(resultText)
          // Сохраняем результат в кэш
          setResultsCache(prev => ({
            ...prev,
            [cacheKey]: {
              result: resultText,
              timestamp: Date.now()
            }
          }))
        } else {
          throw new Error('Получен пустой результат от AI')
        }
      } else {
        throw new Error('Результат не получен от AI или имеет неверный формат')
      }
    } catch (error) {
      setResult(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 sm:p-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Я изучаю Next.js
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Анализ англоязычных статей с помощью AI
          </p>

          {/* Поле ввода URL */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="article-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                URL англоязычной статьи
              </label>
              <button
                type="button"
                onClick={handleClear}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Очистить все"
              >
                Очистить
              </button>
            </div>
            <input
              id="article-url"
              type="url"
              value={url}
              onChange={(e) => {
                const newUrl = e.target.value
                setUrl(newUrl)
                // Очищаем ошибку при вводе
                if (urlError) {
                  setUrlError('')
                }
                // Если URL очищен, сбрасываем все связанные состояния
                if (!newUrl.trim()) {
                  setParsedArticle(null)
                  setIsReady(false)
                  setResult('')
                  setTranslatedText('')
                  setResultsCache({})
                  setActiveAction(null)
                  setParseError(null)
                }
              }}
              onBlur={(e) => {
                // Не запускаем парсинг, если фокус перешел на кнопку
                if (isButtonClick) {
                  setIsButtonClick(false)
                  return
                }
                // Валидация и автоматический парсинг при потере фокуса
                const trimmedUrl = url.trim()
                if (!trimmedUrl) {
                  setUrlError('Пожалуйста, введите URL статьи')
                } else {
                  try {
                    new URL(trimmedUrl)
                    setUrlError('')
                    // Автоматически запускаем парсинг и перевод
                    handleParse()
                  } catch {
                    setUrlError('Введите корректный URL (например, https://example.com/article)')
                  }
                }
              }}
              onKeyDown={(e) => {
                // Автоматический парсинг при нажатии Enter
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const trimmedUrl = url.trim()
                  if (trimmedUrl) {
                    try {
                      new URL(trimmedUrl)
                      setUrlError('')
                      handleParse()
                    } catch {
                      setUrlError('Введите корректный URL (например, https://example.com/article)')
                    }
                  } else {
                    setUrlError('Пожалуйста, введите URL статьи')
                  }
                }
              }}
              placeholder="Введите URL статьи, например: https://example.com/article"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                urlError
                  ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Укажите ссылку на англоязычную статью
            </p>
            {urlError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <span>⚠️</span>
                {urlError}
              </p>
            )}
          </div>

          {/* Блок ошибки парсинга */}
          {parseError && (
            <div className="mb-6">
              <Alert variant="destructive">
                <AlertTitle className="flex items-center gap-2">
                  <span>⚠️</span>
                  Ошибка загрузки статьи
                </AlertTitle>
                <AlertDescription className="mt-2">
                  {parseError.message}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {(['summary', 'thesis', 'telegram'] as const).map((action) => {
              const cacheKey = parsedArticle ? `${parsedArticle.title}_${action}` : ''
              const isCached = cacheKey && resultsCache[cacheKey]
              const buttonLabels = {
                summary: 'О чем статья?',
                thesis: 'Тезисы',
                telegram: 'Пост для Telegram'
              }
              const buttonColors = {
                summary: { active: 'bg-blue-600', inactive: 'bg-blue-500', hover: 'hover:bg-blue-600' },
                thesis: { active: 'bg-green-600', inactive: 'bg-green-500', hover: 'hover:bg-green-600' },
                telegram: { active: 'bg-purple-600', inactive: 'bg-purple-500', hover: 'hover:bg-purple-600' }
              }

              const buttonTitles = {
                summary: 'Получить краткое описание статьи',
                thesis: 'Извлечь основные тезисы из статьи',
                telegram: 'Создать пост для Telegram на основе статьи'
              }

              return (
                <button
                  key={action}
                  type="button"
                  title={buttonTitles[action]}
                  onMouseDown={(e) => {
                    // Устанавливаем флаг перед кликом, чтобы предотвратить onBlur
                    setIsButtonClick(true)
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    // Сбрасываем флаг после небольшой задержки
                    setTimeout(() => setIsButtonClick(false), 100)
                    handleAction(action)
                  }}
                  disabled={loading || !parsedArticle || !isReady}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 relative ${
                    activeAction === action
                      ? `${buttonColors[action].active} text-white shadow-lg`
                      : `${buttonColors[action].inactive} text-white ${buttonColors[action].hover}`
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {loading && activeAction === action ? 'Обработка...' : buttonLabels[action]}
                    {isCached && !loading && (
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded" title="Результат закэширован">
                        ✓
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Блок статуса текущего процесса */}
          {(loading || activeAction) && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                <span className="text-sm font-medium">
                  {loading && !activeAction && 'Загружаю статью...'}
                  {activeAction === 'summary' && 'Генерирую резюме статьи...'}
                  {activeAction === 'thesis' && 'Извлекаю тезисы...'}
                  {activeAction === 'telegram' && 'Создаю пост для Telegram...'}
                </span>
              </div>
            </div>
          )}

          {/* Блок для отображения результата */}
          <div className="mt-8" ref={resultRef}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Результат
              </h2>
              {result && !result.startsWith('Ошибка:') && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-sm px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-2"
                  title="Копировать результат"
                >
                  {copied ? (
                    <>
                      <span>✓</span>
                      <span>Скопировано</span>
                    </>
                  ) : (
                    <>
                      <span>📋</span>
                      <span>Копировать</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 min-h-[200px] border border-gray-200 dark:border-gray-700">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                  <span className="mt-4 text-gray-600 dark:text-gray-400">
                    {activeAction === 'summary' && 'Генерация резюме...'}
                    {activeAction === 'thesis' && 'Извлечение тезисов...'}
                    {activeAction === 'telegram' && 'Создание поста для Telegram...'}
                    {!activeAction && 'Обработка...'}
                  </span>
                </div>
              ) : result ? (
                <div className="max-w-none">
                  {result.startsWith('Ошибка:') ? (
                    <Alert variant="destructive">
                      <AlertTitle className="flex items-center gap-2">
                        <span>⚠️</span>
                        Произошла ошибка
                      </AlertTitle>
                      <AlertDescription className="mt-2">
                        {result.replace('Ошибка: ', '')}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="prose dark:prose-invert max-w-none">
                      <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 text-base leading-relaxed bg-white dark:bg-gray-800 p-4 rounded border overflow-auto">
                        {result}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  {!parsedArticle 
                    ? 'Нажмите "Парсить статью" для извлечения данных из статьи'
                    : 'Выберите действие для обработки статьи'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
