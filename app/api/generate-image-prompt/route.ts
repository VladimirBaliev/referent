import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Текст статьи не предоставлен' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY

    if (!apiKey) {
      console.error('OPENROUTER_API_KEY is not configured')
      return NextResponse.json(
        { error: 'API ключ не настроен. Обратитесь к администратору.' },
        { status: 500 }
      )
    }

    // Генерируем промпт для изображения на основе статьи
    const systemPrompt = 'Ты эксперт по созданию промптов для генерации изображений. На основе следующей статьи создай детальный промпт на английском языке для генерации иллюстрации. Промпт должен быть: конкретным и описательным, содержать визуальные детали (стиль, композиция, цвета), отражать основную тему статьи, длиной 50-100 слов. Промпт должен быть готов для использования в AI-генераторе изображений. Верни только промпт, без дополнительных пояснений.'

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Referent - Image Prompt Generator'
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
        max_tokens: 300
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenRouter API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      })
      
      let errorMessage = 'Ошибка при генерации промпта'
      if (response.status === 429) {
        errorMessage = 'Превышен лимит запросов к API. Пожалуйста, подождите немного и попробуйте снова.'
      } else if (response.status === 401) {
        errorMessage = 'Ошибка аутентификации API. Проверьте настройки API ключа.'
      } else if (response.status === 403) {
        errorMessage = 'Доступ запрещен. Проверьте права доступа API ключа.'
      } else if (response.status >= 500) {
        errorMessage = 'Сервис временно недоступен. Попробуйте позже.'
      } else {
        errorMessage = `Ошибка API: ${response.statusText || 'Неизвестная ошибка'}`
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response from OpenRouter API:', data)
      return NextResponse.json(
        { error: 'Получен некорректный ответ от API' },
        { status: 500 }
      )
    }

    const prompt = data.choices[0].message.content.trim()

    if (!prompt || typeof prompt !== 'string') {
      console.error('Empty or invalid prompt from API:', data)
      return NextResponse.json(
        { error: 'Получен пустой промпт от AI' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      prompt,
      model: data.model,
      usage: data.usage
    })

  } catch (error) {
    console.error('Generate image prompt error:', error)
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Произошла неизвестная ошибка при генерации промпта'
    return NextResponse.json(
      { 
        error: errorMessage,
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}


