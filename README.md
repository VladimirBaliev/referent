# Referent

Я изучаю Next.js

## Разработка

Установите зависимости:

```powershell
npm install
```

Запустите сервер разработки:

```powershell
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## Деплой на Vercel

Проект готов к деплою на Vercel. Есть несколько способов:

### Способ 1: Через веб-интерфейс Vercel

1. Перейдите на [vercel.com](https://vercel.com)
2. Войдите в аккаунт (можно через GitHub)
3. Нажмите "Add New Project"
4. Импортируйте репозиторий из GitHub/GitLab/Bitbucket
5. Vercel автоматически определит Next.js и настроит проект
6. Нажмите "Deploy"

### Способ 2: Через Vercel CLI

Установите Vercel CLI:

```powershell
npm install -g vercel
```

Выполните деплой:

```powershell
vercel
```

Для продакшен деплоя:

```powershell
vercel --prod
```

### Способ 3: Автоматический деплой через Git

1. Подключите репозиторий к Vercel
2. При каждом push в основную ветку будет происходить автоматический деплой
3. Pull Request'ы будут создавать preview деплои

## Скрипты

- `npm run dev` - запуск в режиме разработки
- `npm run build` - сборка для продакшена
- `npm run start` - запуск продакшен-сборки
- `npm run lint` - проверка кода линтером

## Структура проекта

```
.
├── app/              # App Router директория
│   ├── layout.tsx   # Корневой layout
│   ├── page.tsx     # Главная страница
│   └── globals.css  # Глобальные стили
├── next.config.js   # Конфигурация Next.js
├── package.json     # Зависимости и скрипты
├── tsconfig.json    # Конфигурация TypeScript
└── vercel.json      # Конфигурация Vercel
```
