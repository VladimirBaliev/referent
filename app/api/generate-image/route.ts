import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    let prompt: string
    try {
      const body = await request.json()
      prompt = body.prompt
      console.log('Generate image request received, prompt length:', prompt?.length || 0)
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json(
        { error: 'Не удалось прочитать данные запроса. Убедитесь, что отправлен корректный JSON.' },
        { status: 400 }
      )
    }

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
    
    console.log('API key found, length:', apiKey.length)

    // Используем модели для генерации изображений через Hugging Face Inference API
    // Приоритет: проверенные Stable Diffusion модели
    // Модель DeepSeek Janus-Pro-7B может требовать специальной настройки или недоступна через стандартный API
    const models = [
      'runwayml/stable-diffusion-v1-5', // Надежная модель Stable Diffusion
      'stabilityai/stable-diffusion-2-1', // Альтернативная модель Stable Diffusion
      'CompVis/stable-diffusion-v1-4', // Резервная модель Stable Diffusion
      // 'deepseek-ai/Janus-Pro-7B' // Временно отключена - может требовать специального формата запроса
    ]

    let lastError: any = null
    let imageBlob: Blob | null = null
    let usedModel: string | null = null
    const attemptedModels: string[] = []

    // Пробуем каждую модель по очереди
    for (const model of models) {
      let timeoutId: NodeJS.Timeout | null = null
      try {
        const apiUrl = `https://api-inference.huggingface.co/models/${model}`
        
        console.log(`Attempting to generate image with model: ${model}`)
        attemptedModels.push(model)
        
        // Создаем AbortController для таймаута
        const controller = new AbortController()
        timeoutId = setTimeout(() => controller.abort(), 60000) // 60 секунд
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              wait_for_model: true, // Ждем загрузки модели, если она не загружена
              return_full_text: false
            }
          }),
          signal: controller.signal
        })
        
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }

        if (response.ok) {
          const contentType = response.headers.get('content-type')
          
          // Проверяем, что ответ действительно является изображением
          if (contentType && contentType.startsWith('image/')) {
            imageBlob = await response.blob()
            usedModel = model
            console.log(`Successfully generated image using model: ${model}`)
            break // Успешно получили изображение
          } else {
            // Если ответ не изображение, возможно это JSON с ошибкой
            const textResponse = await response.text()
            try {
              const jsonResponse = JSON.parse(textResponse)
              if (jsonResponse.error) {
                console.error(`Model ${model} returned error in response:`, jsonResponse.error)
                lastError = {
                  status: response.status,
                  statusText: response.statusText,
                  error: jsonResponse.error,
                  model
                }
                continue
              }
            } catch {
              // Не JSON, просто текст ошибки
              console.error(`Model ${model} returned non-image response:`, textResponse.substring(0, 200))
              lastError = {
                status: response.status,
                statusText: response.statusText,
                error: `Unexpected content type: ${contentType}`,
                model
              }
              continue
            }
          }
        } else if (response.status === 503) {
          // Модель загружается, пробуем следующую
          const errorText = await response.text().catch(() => 'Unable to read error')
          console.log(`Model ${model} is loading (503), trying next... Error: ${errorText.substring(0, 200)}`)
          lastError = {
            status: 503,
            statusText: 'Service Unavailable',
            error: errorText,
            model
          }
          continue
        } else if (response.status === 410) {
          // Модель больше недоступна, пробуем следующую
          console.log(`Model ${model} is gone, trying next...`)
          continue
        } else {
          // Другая ошибка, сохраняем для последнего сообщения
          let errorText = ''
          try {
            errorText = await response.text()
          } catch (e) {
            errorText = `Failed to read error response: ${e}`
          }
          console.error(`Model ${model} failed with status ${response.status}:`, errorText.substring(0, 500))
          lastError = {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            model
          }
          continue
        }
      } catch (error: any) {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        console.error(`Error with model ${model}:`, error)
        // Обрабатываем ошибки таймаута и сети
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          lastError = {
            status: 408,
            statusText: 'Request Timeout',
            error: 'Превышено время ожидания ответа от модели',
            model
          }
        } else if (error.message) {
          lastError = {
            status: 0,
            statusText: 'Network Error',
            error: error.message,
            model
          }
        } else {
          lastError = error
        }
        continue
      }
    }

    // Если ни одна модель не сработала
    if (!imageBlob) {
      console.error('All models failed. Last error:', lastError)
      console.error('Attempted models:', attemptedModels)
      
      let errorMessage = `Не удалось сгенерировать изображение.`
      if (attemptedModels.length > 0) {
        errorMessage += ` Протестированы модели: ${attemptedModels.join(', ')}.`
      } else {
        errorMessage += ' Модели не были протестированы.'
      }
      
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
      
      // Всегда возвращаем детали ошибки для диагностики
      const errorDetails: any = {
        attemptedModels: attemptedModels,
        modelsCount: models.length,
        attemptedCount: attemptedModels.length
      }
      
      if (lastError) {
        errorDetails.lastModel = lastError.model
        errorDetails.status = lastError.status
        errorDetails.statusText = lastError.statusText
        
        if (lastError.error) {
          if (typeof lastError.error === 'string') {
            errorDetails.errorPreview = lastError.error.substring(0, 500)
          } else {
            errorDetails.errorPreview = JSON.stringify(lastError.error).substring(0, 500)
          }
        }
      } else {
        errorDetails.note = 'No error details captured - all models may have failed silently'
      }
      
      console.error('Returning error response:', {
        errorMessage,
        errorDetails,
        lastError
      })
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorDetails
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
    console.error('Generate image error (catch block):', error)
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Произошла неизвестная ошибка при генерации изображения'
    
    // Логируем полную информацию об ошибке
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    } else {
      console.error('Error is not an Error instance:', typeof error, error)
    }
    
    // Всегда возвращаем детали для диагностики
    return NextResponse.json(
      { 
        error: errorMessage,
        errorType: 'unexpected',
        details: {
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : String(error),
          ...(process.env.NODE_ENV === 'development' && error instanceof Error ? {
            stack: error.stack
          } : {})
        }
      },
      { status: 500 }
    )
  }
}


