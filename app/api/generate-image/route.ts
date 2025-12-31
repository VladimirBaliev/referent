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

    // Используем модели для генерации изображений через Hugging Face Inference API
    // Приоритет: сначала проверенные Stable Diffusion модели, затем DeepSeek
    // Пробуем несколько моделей по очереди, если одна недоступна
    const models = [
      'runwayml/stable-diffusion-v1-5', // Надежная модель Stable Diffusion
      'stabilityai/stable-diffusion-2-1', // Альтернативная модель Stable Diffusion
      'CompVis/stable-diffusion-v1-4', // Резервная модель Stable Diffusion
      'deepseek-ai/Janus-Pro-7B' // Модель DeepSeek для генерации изображений (может требовать специальной настройки)
    ]

    let lastError: any = null
    let imageBlob: Blob | null = null
    let usedModel: string | null = null

    // Пробуем каждую модель по очереди
    for (const model of models) {
      try {
        const apiUrl = `https://api-inference.huggingface.co/models/${model}`
        
        console.log(`Attempting to generate image with model: ${model}`)
        
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
          usedModel = model
          console.log(`Successfully generated image using model: ${model}`)
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
          console.error(`Model ${model} failed with status ${response.status}:`, errorText)
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
        } else if (lastError.status === 404) {
          errorMessage = `Модель ${lastError.model || 'неизвестная'} не найдена. Возможно, модель недоступна или требует другого формата запроса.`
        } else if (lastError.status >= 500) {
          errorMessage = 'Сервис генерации изображений временно недоступен. Попробуйте позже.'
        } else {
          // Показываем более детальную информацию об ошибке
          const errorDetails = lastError.error ? (typeof lastError.error === 'string' ? lastError.error.substring(0, 200) : JSON.stringify(lastError.error).substring(0, 200)) : ''
          errorMessage = `Ошибка API (${lastError.status}): ${lastError.statusText || 'Неизвестная ошибка'}${errorDetails ? `. ${errorDetails}` : ''}`
        }
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          ...(process.env.NODE_ENV === 'development' && lastError ? {
            details: {
              lastModel: lastError.model,
              status: lastError.status,
              statusText: lastError.statusText,
              errorPreview: typeof lastError.error === 'string' 
                ? lastError.error.substring(0, 500) 
                : lastError.error
            }
          } : {})
        },
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
      mimeType,
      model: usedModel // Информация о модели, которая использовалась
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


