import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Загружаем HTML страницы
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

