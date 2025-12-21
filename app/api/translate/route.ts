import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY is not configured' },
        { status: 500 }
      )
    }

    // Запрос к OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Referent - Article Translator'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Ты профессиональный переводчик. Переведи следующий английский текст на русский язык, сохраняя структуру и форматирование оригинала.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenRouter API error:', errorData)
      return NextResponse.json(
        { error: `OpenRouter API error: ${response.statusText}`, details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return NextResponse.json(
        { error: 'Invalid response from OpenRouter API' },
        { status: 500 }
      )
    }

    const translatedText = data.choices[0].message.content

    return NextResponse.json({
      translation: translatedText,
      model: data.model,
      usage: data.usage
    })

  } catch (error) {
    console.error('Translate error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

