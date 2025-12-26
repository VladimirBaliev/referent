import { NextRequest, NextResponse } from 'next/server'

type ActionType = 'summary' | 'thesis' | 'telegram'

const SYSTEM_PROMPTS: Record<ActionType, string> = {
  summary: 'Ты эксперт по анализу статей. Напиши краткое, но информативное резюме следующей статьи на русском языке (2-3 абзаца). Резюме должно отражать основные идеи, ключевые выводы и важные детали статьи. Будь точным и избегай общих фраз.',
  thesis: 'Ты эксперт по анализу статей. Извлеки основные тезисы из следующей статьи и представь их в виде нумерованного списка на русском языке. Каждый тезис должен быть кратким (1-2 предложения), содержательным и отражать конкретную идею из статьи. Сфокусируйся на наиболее важных моментах.',
  telegram: 'Ты эксперт по созданию контента для социальных сетей. Создай привлекательный пост для Telegram на основе следующей статьи. Пост должен быть: интересным и цепляющим, структурированным (с абзацами), с уместными эмодзи, длиной 2-3 абзаца, на русском языке. Используй эмодзи для привлечения внимания и улучшения читаемости. Начни с интригующего вступления. В конце поста обязательно добавь ссылку на источник статьи в формате: "📎 Источник: [ссылка]" или "🔗 Читать полностью: [ссылка]".'
}

// Параметры модели для каждого типа действия
const MODEL_PARAMS: Record<ActionType, { temperature: number; max_tokens: number }> = {
  summary: { temperature: 0.6, max_tokens: 1500 },
  thesis: { temperature: 0.5, max_tokens: 2000 },
  telegram: { temperature: 0.8, max_tokens: 1500 }
}

// Максимальная длина текста для одного запроса (примерно 100k символов, оставляем запас)
const MAX_TEXT_LENGTH = 80000

// Функция для разбиения длинного текста на части
function splitTextIntoChunks(text: string, maxLength: number = MAX_TEXT_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text]
  }

  const chunks: string[] = []
  let currentIndex = 0

  while (currentIndex < text.length) {
    let endIndex = currentIndex + maxLength

    // Если это не последний чанк, пытаемся разбить по предложению или абзацу
    if (endIndex < text.length) {
      // Ищем последний перенос строки в пределах чанка
      const lastNewline = text.lastIndexOf('\n\n', endIndex)
      if (lastNewline > currentIndex + maxLength * 0.5) {
        endIndex = lastNewline + 2
      } else {
        // Ищем последнюю точку с пробелом
        const lastPeriod = text.lastIndexOf('. ', endIndex)
        if (lastPeriod > currentIndex + maxLength * 0.5) {
          endIndex = lastPeriod + 2
        }
      }
    }

    chunks.push(text.slice(currentIndex, endIndex))
    currentIndex = endIndex
  }

  return chunks
}

export async function POST(request: NextRequest) {
  try {
    const { text, action, sourceUrl } = await request.json()

    // Валидация входных данных
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    if (!['summary', 'thesis', 'telegram'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: summary, thesis, telegram' },
        { status: 400 }
      )
    }

    // Проверка наличия API ключа
    const apiKey = process.env.OPENROUTER_API_KEY

    if (!apiKey) {
      console.error('OPENROUTER_API_KEY is not configured')
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const actionType = action as ActionType
    const systemPrompt = SYSTEM_PROMPTS[actionType]
    const { temperature, max_tokens } = MODEL_PARAMS[actionType]

    // Функция для выполнения запроса к OpenRouter API
    const makeApiRequest = async (textChunk: string, isChunk: boolean = false): Promise<string> => {
      let finalPrompt = systemPrompt
      
      // Для telegram добавляем URL источника в промпт
      if (actionType === 'telegram' && sourceUrl) {
        finalPrompt = `${systemPrompt}\n\nURL источника статьи: ${sourceUrl}`
      }
      
      const chunkPrompt = isChunk 
        ? `${finalPrompt}\n\nОбработай следующую часть статьи. Это часть ${isChunk ? 'длинной' : ''} статьи, поэтому сфокусируйся на ключевых моментах этой части.`
        : finalPrompt

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Referent - Article AI Processor'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat',
          messages: [
            {
              role: 'system',
              content: chunkPrompt
            },
            {
              role: 'user',
              content: textChunk
            }
          ],
          temperature,
          max_tokens
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('OpenRouter API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
        throw new Error(`OpenRouter API error: ${response.statusText}`)
      }

      const data = await response.json()

      // Валидация ответа от API
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Invalid response from OpenRouter API:', data)
        throw new Error('Invalid response from OpenRouter API')
      }

      const result = data.choices[0].message.content

      if (!result || typeof result !== 'string') {
        console.error('Empty or invalid result from API:', data)
        throw new Error('Empty result from AI')
      }

      return result
    }

    // Обработка длинных статей: разбиение на части
    const textChunks = splitTextIntoChunks(text)
    let finalResult: string
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    let modelName = 'deepseek/deepseek-chat'

    if (textChunks.length === 1) {
      // Короткая статья - обрабатываем напрямую
      // Для telegram добавляем URL источника в промпт
      let finalSystemPrompt = systemPrompt
      if (actionType === 'telegram' && sourceUrl) {
        finalSystemPrompt = `${systemPrompt}\n\nURL источника статьи: ${sourceUrl}`
      }
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Referent - Article AI Processor'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat',
          messages: [
            {
              role: 'system',
              content: finalSystemPrompt
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature,
          max_tokens
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('OpenRouter API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
        return NextResponse.json(
          { 
            error: `OpenRouter API error: ${response.statusText}`, 
            details: errorData 
          },
          { status: response.status }
        )
      }

      const data = await response.json()

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Invalid response from OpenRouter API:', data)
        return NextResponse.json(
          { error: 'Invalid response from OpenRouter API' },
          { status: 500 }
        )
      }

      finalResult = data.choices[0].message.content
      if (!finalResult || typeof finalResult !== 'string') {
        console.error('Empty or invalid result from API:', data)
        return NextResponse.json(
          { error: 'Empty result from AI' },
          { status: 500 }
        )
      }

      modelName = data.model
      totalUsage = data.usage || totalUsage
    } else {
      // Длинная статья - обрабатываем по частям
      const chunkResults: string[] = []

      for (let i = 0; i < textChunks.length; i++) {
        const chunkResult = await makeApiRequest(textChunks[i], true)
        chunkResults.push(chunkResult)
      }

      // Объединяем результаты в зависимости от типа действия
      if (actionType === 'summary') {
        // Для резюме - создаем финальное резюме из всех частей
        const combinedText = chunkResults.join('\n\n')
        finalResult = await makeApiRequest(
          `Ниже представлены резюме разных частей одной статьи. Создай единое краткое резюме всей статьи на основе этих частей:\n\n${combinedText}`,
          false
        )
      } else if (actionType === 'thesis') {
        // Для тезисов - объединяем списки, убирая дубликаты
        const allTheses = chunkResults.join('\n')
        finalResult = await makeApiRequest(
          `Ниже представлены тезисы из разных частей одной статьи. Объедини их в единый нумерованный список, убрав дубликаты и сгруппировав похожие тезисы:\n\n${allTheses}`,
          false
        )
      } else {
        // Для Telegram поста - создаем финальный пост из всех частей
        const combinedText = chunkResults.join('\n\n')
        const telegramPrompt = sourceUrl 
          ? `Ниже представлены посты для Telegram из разных частей одной статьи. Создай единый привлекательный пост для Telegram на основе всей статьи. В конце поста обязательно добавь ссылку на источник в формате: "📎 Источник: ${sourceUrl}" или "🔗 Читать полностью: ${sourceUrl}".\n\n${combinedText}`
          : `Ниже представлены посты для Telegram из разных частей одной статьи. Создай единый привлекательный пост для Telegram на основе всей статьи:\n\n${combinedText}`
        finalResult = await makeApiRequest(telegramPrompt, false)
      }
    }

    return NextResponse.json({
      result: finalResult,
      action: actionType,
      model: modelName,
      usage: totalUsage,
      chunksProcessed: textChunks.length
    })

  } catch (error) {
    console.error('AI Process error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

