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

    // Проверяем переменную окружения (пробуем разные варианты названий)
    const apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY

    if (!apiKey) {
      console.error('HUGGINGFACE_API_KEY is not configured')
      console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('HUGGING') || key.includes('HF')))
      return NextResponse.json(
        { error: 'API ключ Hugging Face не настроен. Убедитесь, что в файле .env.local есть переменная HUGGINGFACE_API_KEY и перезапустите сервер разработки.' },
        { status: 500 }
      )
    }

    // Используем модель Stable Diffusion через Hugging Face Inference API
    // Пробуем несколько моделей по очереди, если одна недоступна
    const models = [
      'runwayml/stable-diffusion-v1-5',
      'stabilityai/stable-diffusion-2-1',
      'CompVis/stable-diffusion-v1-4'
    ]

    let lastError: any = null
    let imageBlob: Blob | null = null

    // Пробуем каждую модель по очереди
    for (const model of models) {
      try {
        const apiUrl = `https://api-inference.huggingface.co/models/${model}`
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: prompt
          })
        })

        if (response.ok) {
          imageBlob = await response.blob()
          break // Успешно получили изображение
        } else if (response.status === 503) {
          // Модель загружается, пробуем следующую
          console.log(`Model ${model} is loading, trying next...`)
          continue
        } else if (response.status === 410) {
          // Модель больше недоступна, пробуем следующую
          console.log(`Model ${model} is gone, trying next...`)
          continue
        } else {
          // Другая ошибка, сохраняем для последнего сообщения
          const errorText = await response.text()
          lastError = {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            model
          }
          continue
        }
      } catch (error) {
        console.error(`Error with model ${model}:`, error)
        lastError = error
        continue
      }
    }

    // Если ни одна модель не сработала
    if (!imageBlob) {
      console.error('All models failed. Last error:', lastError)
      
      let errorMessage = 'Не удалось сгенерировать изображение. Все модели недоступны.'
      if (lastError) {
        if (lastError.status === 429) {
          errorMessage = 'Превышен лимит запросов к API. Пожалуйста, подождите немного и попробуйте снова.'
        } else if (lastError.status === 401) {
          errorMessage = 'Ошибка аутентификации API. Проверьте настройки API ключа Hugging Face.'
        } else if (lastError.status === 403) {
          errorMessage = 'Доступ запрещен. Проверьте права доступа API ключа.'
        } else if (lastError.status === 503) {
          errorMessage = 'Модели загружаются. Пожалуйста, подождите немного и попробуйте снова.'
        } else if (lastError.status === 410) {
          errorMessage = 'Модели больше недоступны. Попробуйте позже или используйте другой сервис генерации изображений.'
        } else if (lastError.status >= 500) {
          errorMessage = 'Сервис генерации изображений временно недоступен. Попробуйте позже.'
        } else {
          errorMessage = `Ошибка API: ${lastError.statusText || 'Неизвестная ошибка'}`
        }
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: lastError?.status || 500 }
      )
    }

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


