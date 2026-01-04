import { NextRequest, NextResponse } from 'next/server'
import { HfInference } from '@huggingface/inference'

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

    // Создаем InferenceClient
    const hf = new HfInference(apiKey)

    // Используем модели, доступные через Inference Providers
    // Старые Stable Diffusion модели могут не поддерживаться, пробуем разные варианты
    const modelConfigs = [
      { model: 'stabilityai/stable-diffusion-2-1', provider: 'hf-inference' as const },
      { model: 'stabilityai/stable-diffusion-2-1', provider: undefined }, // Попробуем без провайдера
    ]

    let lastError: any = null
    let imageBlob: Blob | null = null
    let usedModel: string | null = null
    const attemptedModels: string[] = []

    // Пробуем каждую модель по очереди
    for (const { model, provider } of modelConfigs) {
      try {
        const providerLabel = provider || 'auto'
        console.log(`Attempting to generate image with model: ${model}, provider: ${providerLabel}`)
        attemptedModels.push(`${model} (${providerLabel})`)
        
        // Используем InferenceClient с указанием провайдера (или без него)
        const requestConfig: any = {
          model: model,
          inputs: prompt,
        }
        if (provider) {
          requestConfig.provider = provider
        }
        
        const imageBlobResult = await hf.textToImage(
          requestConfig,
          {
            outputType: 'blob' as const,
          }
        )
        
        // textToImage возвращает Blob напрямую
        if (imageBlobResult && imageBlobResult.size > 0) {
          imageBlob = imageBlobResult
          usedModel = model
          console.log(`Successfully generated image using model: ${model}, size: ${imageBlob.size} bytes`)
          break // Успешно получили изображение
        } else {
          console.error(`Model ${model} returned invalid image blob`)
          lastError = {
            status: 500,
            statusText: 'Invalid response',
            error: 'Received invalid image blob',
            model
          }
          continue
        }
      } catch (error: any) {
        console.error(`Error with model ${model}:`, error)
        
        // Обрабатываем различные типы ошибок
        let errorStatus = 500
        let errorStatusText = 'Internal Server Error'
        let errorMessage = 'Неизвестная ошибка'
        
        if (error.message) {
          errorMessage = error.message
        }
        
        // Проверяем специфичные ошибки Hugging Face API
        if (error.message?.includes('No Inference Provider available') || error.message?.includes('No provider')) {
          errorStatus = 503
          errorStatusText = 'Service Unavailable'
          errorMessage = `Модель ${model} недоступна через Inference Providers.`
        } else if (error.message?.includes('503') || error.message?.includes('loading')) {
          errorStatus = 503
          errorStatusText = 'Service Unavailable'
          errorMessage = 'Модель загружается. Попробуйте подождать и повторить запрос.'
        } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          errorStatus = 401
          errorStatusText = 'Unauthorized'
          errorMessage = 'Ошибка аутентификации API. Проверьте API ключ.'
        } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
          errorStatus = 403
          errorStatusText = 'Forbidden'
          errorMessage = 'Доступ запрещен. Проверьте права доступа API ключа.'
        } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          errorStatus = 429
          errorStatusText = 'Too Many Requests'
          errorMessage = 'Превышен лимит запросов. Подождите немного.'
        } else if (error.message?.includes('404') || error.message?.includes('Not Found')) {
          errorStatus = 404
          errorStatusText = 'Not Found'
          errorMessage = `Модель ${model} не найдена.`
        } else if (error.message?.includes('timeout') || error.name === 'AbortError') {
          errorStatus = 408
          errorStatusText = 'Request Timeout'
          errorMessage = 'Превышено время ожидания ответа от модели'
        }
        
        lastError = {
          status: errorStatus,
          statusText: errorStatusText,
          error: errorMessage,
          model,
          originalError: error.message || String(error)
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
          errorMessage = 'Превышен лимит запросов к API Hugging Face. Пожалуйста, подождите немного и попробуйте снова.'
        } else if (lastError.status === 401) {
          errorMessage = 'Ошибка аутентификации API. Проверьте, что в файле .env.local указан корректный HUGGINGFACE_API_KEY и перезапустите сервер разработки.'
        } else if (lastError.status === 403) {
          errorMessage = 'Доступ запрещен. Проверьте, что ваш API ключ Hugging Face корректен и активен. Получите токен на https://huggingface.co/settings/tokens (тип: Read) и добавьте его в .env.local как HUGGINGFACE_API_KEY.'
        } else if (lastError.status === 503) {
          errorMessage = 'Модели загружаются на сервере Hugging Face. Это может занять несколько минут при первом использовании. Попробуйте подождать и повторить запрос через 1-2 минуты.'
        } else if (lastError.status === 410) {
          errorMessage = 'Модели больше недоступны через Hugging Face API. Попробуйте позже или используйте другой сервис генерации изображений.'
        } else if (lastError.status === 404) {
          errorMessage = `Модель ${lastError.model || 'неизвестная'} не найдена. Возможно, модель недоступна или требует другого формата запроса.`
        } else if (lastError.status >= 500) {
          errorMessage = 'Сервис генерации изображений Hugging Face временно недоступен. Попробуйте позже.'
        } else if (lastError.status === 0 || lastError.statusText === 'Network Error') {
          errorMessage = 'Ошибка сети при подключении к Hugging Face API. Проверьте подключение к интернету и попробуйте снова.'
        } else {
          // Показываем более детальную информацию об ошибке
          const errorDetails = lastError.error ? (typeof lastError.error === 'string' ? lastError.error.substring(0, 200) : JSON.stringify(lastError.error).substring(0, 200)) : ''
          errorMessage = `Ошибка API (${lastError.status}): ${lastError.statusText || 'Неизвестная ошибка'}${errorDetails ? `. ${errorDetails}` : ''}`
        }
      } else {
        // Если нет информации об ошибке, возможно проблема с конфигурацией
        errorMessage += ' Возможно, проблема с настройкой API ключа или доступом к сервису.'
      }
      
      // Всегда возвращаем детали ошибки для диагностики
      const errorDetails: any = {
        attemptedModels: attemptedModels,
        modelsCount: modelConfigs.length,
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


