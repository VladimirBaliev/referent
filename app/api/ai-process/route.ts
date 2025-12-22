import { NextRequest, NextResponse } from 'next/server'

type ActionType = 'summary' | 'thesis' | 'telegram'

const SYSTEM_PROMPTS: Record<ActionType, string> = {
  summary: 'Ты эксперт по анализу статей. Напиши краткое резюме следующей статьи на русском языке (2-3 абзаца). Резюме должно быть информативным и отражать основные идеи статьи.',
  thesis: 'Ты эксперт по анализу статей. Извлеки основные тезисы из следующей статьи и представь их в виде нумерованного списка на русском языке. Каждый тезис должен быть кратким и содержательным.',
  telegram: 'Ты эксперт по созданию контента для социальных сетей. Создай пост для Telegram на основе следующей статьи. Пост должен быть: интересным, структурированным, с эмодзи, длиной 2-3 абзаца, на русском языке. Используй эмодзи для привлечения внимания.'
}

export async function POST(request: NextRequest) {
  try {
    const { text, action } = await request.json()

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

    // Запрос к OpenRouter API
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
            content: systemPrompt
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
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

    // Валидация ответа от API
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response from OpenRouter API:', data)
      return NextResponse.json(
        { error: 'Invalid response from OpenRouter API' },
        { status: 500 }
      )
    }

    const result = data.choices[0].message.content

    if (!result || typeof result !== 'string') {
      console.error('Empty or invalid result from API:', data)
      return NextResponse.json(
        { error: 'Empty result from AI' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      result: result,
      action: actionType,
      model: data.model,
      usage: data.usage
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

