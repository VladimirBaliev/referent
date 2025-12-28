import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL не указан', errorType: 'validation' },
        { status: 400 }
      )
    }

    // Валидация формата URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Некорректный формат URL', errorType: 'validation' },
        { status: 400 }
      )
    }

    // Загружаем HTML страницы с таймаутом
    let response: Response
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 секунд таймаут

      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Не удалось загрузить статью по этой ссылке.', errorType: 'timeout', details: 'Превышено время ожидания ответа от сервера' },
          { status: 408 }
        )
      }
      // Другие ошибки сети
      return NextResponse.json(
        { error: 'Не удалось загрузить статью по этой ссылке.', errorType: 'network', details: 'Проверьте подключение к интернету и доступность ссылки' },
        { status: 503 }
      )
    }

    if (!response.ok) {
      let errorMessage = 'Не удалось загрузить статью по этой ссылке.'
      let errorType = 'fetch'
      
      if (response.status === 404) {
        errorMessage = 'Не удалось загрузить статью по этой ссылке.'
        errorType = 'not_found'
      } else if (response.status === 403) {
        errorMessage = 'Не удалось загрузить статью по этой ссылке.'
        errorType = 'forbidden'
        // details: 'Доступ к этой странице запрещен'
      } else if (response.status >= 500) {
        errorMessage = 'Не удалось загрузить статью по этой ссылке.'
        errorType = 'server_error'
        // details: 'Сервер временно недоступен'
      } else if (response.status === 401) {
        errorMessage = 'Не удалось загрузить статью по этой ссылке.'
        errorType = 'unauthorized'
      }

      return NextResponse.json(
        { error: errorMessage, errorType },
        { status: response.status }
      )
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Ищем заголовок статьи
    let title = ''
    const titleSelectors = [
      'h1',
      'article h1',
      '.post-title',
      '.article-title',
      '[itemprop="headline"]',
      'meta[property="og:title"]',
      'title'
    ]

    for (const selector of titleSelectors) {
      if (selector.startsWith('meta')) {
        const metaTitle = $(selector).attr('content')
        if (metaTitle) {
          title = metaTitle.trim()
          break
        }
      } else {
        const element = $(selector).first()
        if (element.length && element.text().trim()) {
          title = element.text().trim()
          break
        }
      }
    }

    // Ищем дату статьи
    let date = ''
    const dateSelectors = [
      'time[datetime]',
      'time',
      '[itemprop="datePublished"]',
      '.date',
      '.published',
      '.post-date',
      '.article-date',
      'meta[property="article:published_time"]',
      'meta[name="publish-date"]'
    ]

    for (const selector of dateSelectors) {
      if (selector.startsWith('meta')) {
        const metaDate = $(selector).attr('content')
        if (metaDate) {
          date = metaDate.trim()
          break
        }
      } else {
        const element = $(selector).first()
        const datetime = element.attr('datetime') || element.text().trim()
        if (datetime) {
          date = datetime.trim()
          break
        }
      }
    }

    // Ищем основной контент статьи
    let content = ''
    const contentSelectors = [
      'article',
      '.post',
      '.content',
      '.article-content',
      '.post-content',
      '[itemprop="articleBody"]',
      'main article',
      '.entry-content'
    ]

    for (const selector of contentSelectors) {
      const element = $(selector).first()
      if (element.length) {
        // Удаляем ненужные элементы (скрипты, стили, реклама и т.д.)
        element.find('script, style, nav, aside, .advertisement, .ads, .sidebar').remove()
        
        // Получаем текст, сохраняя структуру параграфов
        content = element
          .find('p, h1, h2, h3, h4, h5, h6, li')
          .map((_, el) => $(el).text().trim())
          .get()
          .filter(text => text.length > 0)
          .join('\n\n')
          .trim()

        if (content.length > 100) {
          break
        }
      }
    }

    // Если контент не найден, пробуем найти все параграфы
    if (!content || content.length < 100) {
      const paragraphs = $('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(text => text.length > 50)
        .slice(0, 10)
        .join('\n\n')
      
      if (paragraphs) {
        content = paragraphs
      }
    }

    return NextResponse.json({
      date: date || null,
      title: title || 'Заголовок не найден',
      content: content || 'Контент не найден'
    })

  } catch (error) {
    console.error('Parse error:', error)
    
    // Обработка различных типов ошибок
    let errorMessage = 'Не удалось загрузить статью по этой ссылке.'
    let errorType = 'unknown'
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Не удалось загрузить статью по этой ссылке.'
        errorType = 'timeout'
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Не удалось загрузить статью по этой ссылке.'
        errorType = 'network'
      }
    }
    
    return NextResponse.json(
      { error: errorMessage, errorType },
      { status: 500 }
    )
  }
}





