'use client'

import { useState } from 'react'

type ActionType = 'summary' | 'thesis' | 'telegram' | null

interface ParsedArticle {
  date: string | null
  title: string
  content: string
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [activeAction, setActiveAction] = useState<ActionType>(null)
  const [parsedArticle, setParsedArticle] = useState<ParsedArticle | null>(null)

  const handleParse = async () => {
    if (!url.trim()) {
      alert('Пожалуйста, введите URL статьи')
      return
    }

    setLoading(true)
    setActiveAction(null)
    setResult('')

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ошибка при парсинге статьи')
      }

      const data = await response.json()
      
      // Сохраняем распарсенные данные для перевода
      setParsedArticle(data)
      
      // Форматируем JSON для красивого отображения
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(JSON.stringify({
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const handleTranslate = async () => {
    if (!parsedArticle || !parsedArticle.content) {
      alert('Сначала распарсите статью, чтобы получить контент для перевода')
      return
    }

    setLoading(true)
    setActiveAction(null)
    setResult('')

    try {
      // Переводим заголовок и контент
      const textToTranslate = `Title: ${parsedArticle.title}\n\n${parsedArticle.content}`

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: textToTranslate }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ошибка при переводе статьи')
      }

      const data = await response.json()
      setResult(data.translation || 'Перевод не получен')
    } catch (error) {
      setResult(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: ActionType) => {
    // Проверка наличия распарсенных данных
    if (!parsedArticle || !parsedArticle.content) {
      alert('Сначала распарсите статью, чтобы получить данные для обработки')
      return
    }

    if (!action) {
      return
    }

    setLoading(true)
    setActiveAction(action)
    setResult('')

    try {
      // Формируем текст для обработки (заголовок + контент)
      const textToProcess = `Title: ${parsedArticle.title}\n\n${parsedArticle.content}`

      const response = await fetch('/api/ai-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: textToProcess,
          action: action
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ошибка при обработке статьи')
      }

      const data = await response.json()
      
      // Отображаем результат
      if (data.result) {
        setResult(data.result)
      } else {
        throw new Error('Результат не получен от AI')
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
            <label htmlFor="article-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              URL англоязычной статьи
            </label>
            <input
              id="article-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Кнопки парсинга и перевода */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <button
              onClick={handleParse}
              disabled={loading}
              className="px-6 py-3 bg-indigo-500 text-white rounded-lg font-medium transition-all duration-200 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Парсить статью
            </button>
            <button
              onClick={handleTranslate}
              disabled={loading || !parsedArticle}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium transition-all duration-200 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Перевести статью
            </button>
          </div>

          {/* Кнопки действий */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <button
              onClick={() => handleAction('summary')}
              disabled={loading || !parsedArticle}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeAction === 'summary'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading && activeAction === 'summary' ? 'Обработка...' : 'О чем статья?'}
            </button>
            <button
              onClick={() => handleAction('thesis')}
              disabled={loading || !parsedArticle}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeAction === 'thesis'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-green-500 text-white hover:bg-green-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading && activeAction === 'thesis' ? 'Обработка...' : 'Тезисы'}
            </button>
            <button
              onClick={() => handleAction('telegram')}
              disabled={loading || !parsedArticle}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeAction === 'telegram'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading && activeAction === 'telegram' ? 'Обработка...' : 'Пост для Telegram'}
            </button>
          </div>

          {/* Блок для отображения результата */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Результат
            </h2>
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
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <p className="text-red-800 dark:text-red-200 font-medium">{result}</p>
                    </div>
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
