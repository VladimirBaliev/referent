import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Промпт для генерации изображения не предоставлен' },
        { status: 400 }
      )
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY

    if (!apiKey) {
      console.error('HUGGINGFACE_API_KEY is not configured')
      return NextResponse.json(
        { error: 'API ключ Hugging Face не настроен. Обратитесь к администратору.' },
        { status: 500 }
      )
    }

    // Используем модель Stable Diffusion через Hugging Face Inference API
    const model = 'stabilityai/stable-diffusion-xl-base-1.0'
    const apiUrl = `https://api-inference.huggingface.co/models/${model}`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          num_inference_steps: 50,
          guidance_scale: 7.5,
          width: 1024,
          height: 1024
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Hugging Face API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      })
      
      let errorMessage = 'Ошибка при генерации изображения'
      if (response.status === 429) {
        errorMessage = 'Превышен лимит запросов к API. Пожалуйста, подождите немного и попробуйте снова.'
      } else if (response.status === 401) {
        errorMessage = 'Ошибка аутентификации API. Проверьте настройки API ключа Hugging Face.'
      } else if (response.status === 403) {
        errorMessage = 'Доступ запрещен. Проверьте права доступа API ключа.'
      } else if (response.status === 503) {
        errorMessage = 'Модель загружается. Пожалуйста, подождите немного и попробуйте снова.'
      } else if (response.status >= 500) {
        errorMessage = 'Сервис генерации изображений временно недоступен. Попробуйте позже.'
      } else {
        errorMessage = `Ошибка API: ${response.statusText || 'Неизвестная ошибка'}`
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    // Получаем изображение в формате blob
    const imageBlob = await response.blob()
    
    // Конвертируем blob в base64 для передачи на клиент
    const arrayBuffer = await imageBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Image = buffer.toString('base64')
    const mimeType = imageBlob.type || 'image/png'
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    return NextResponse.json({
      image: dataUrl,
      mimeType
    })

  } catch (error) {
    console.error('Generate image error:', error)
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Произошла неизвестная ошибка при генерации изображения'
    return NextResponse.json(
      { 
        error: errorMessage,
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}


