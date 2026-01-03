# Referent

Я изучаю Next.js

## Разработка

### Установка зависимостей

Project.md - описание

Вы можете использовать npm или pnpm:

**С npm:**
```powershell
npm install
```

**С pnpm:**
```powershell
pnpm install
```

### Запуск сервера разработки

**С npm:**
```powershell
npm run dev
```

**С pnpm:**
```powershell
pnpm dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## Деплой на Vercel

✅ **Проект полностью готов к деплою на Vercel!**

Все необходимые конфигурации настроены:
- ✅ `vercel.json` - конфигурация для Vercel
- ✅ `next.config.js` - оптимизирован для продакшена
- ✅ `package.json` - указаны версии Node.js и pnpm
- ✅ `.vercelignore` - исключены ненужные файлы
- ✅ `.gitignore` - настроен для Git

Есть несколько способов деплоя:

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

### Чеклист перед деплоем

Перед деплоем убедитесь, что:
- ✅ Код закоммичен и запушен в репозиторий (GitHub/GitLab/Bitbucket)
- ✅ Все зависимости установлены (`pnpm install` или `npm install`)
- ✅ Проект собирается без ошибок (`pnpm build` или `npm run build`)
- ✅ Линтер проходит без ошибок (`pnpm lint` или `npm run lint`)

### Переменные окружения

Проект требует следующие API ключи для работы:

#### Настройка для локальной разработки

Создайте файл `.env.local` в корне проекта и добавьте следующие переменные:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

#### Получение API ключей

**1. OpenRouter API ключ** (для обработки текста):
- Перейдите на [openrouter.ai](https://openrouter.ai)
- Зарегистрируйтесь или войдите
- Перейдите в раздел "Keys" в настройках
- Создайте новый API ключ
- Скопируйте ключ в `.env.local` как `OPENROUTER_API_KEY`

**2. Hugging Face API ключ** (для генерации изображений):
- Перейдите на [huggingface.co](https://huggingface.co)
- Зарегистрируйтесь или войдите
- Перейдите в [настройки токенов](https://huggingface.co/settings/tokens)
- Нажмите "New token"
- Выберите тип токена: **"Read"** (достаточно для Inference API)
- Скопируйте токен в `.env.local` как `HUGGINGFACE_API_KEY`
- ⚠️ **Важно**: Токен типа "Read" автоматически дает доступ к Inference API для бесплатного использования

**Что означает "доступ к Inference API"?**

Inference API — это сервис Hugging Face, который позволяет запускать модели машинного обучения (включая Stable Diffusion для генерации изображений) через простой HTTP API. 

- ✅ **Токен типа "Read"** — дает доступ к Inference API для бесплатного использования (с ограничениями)
- ✅ Любой токен с аккаунта Hugging Face имеет доступ к Inference API по умолчанию
- ❌ Если вы видите ошибку 403, это обычно означает:
  - Токен неверный или истек
  - Токен был удален
  - Проблема с аккаунтом

**После добавления ключей:**
1. Сохраните файл `.env.local`
2. **Обязательно перезапустите сервер разработки** (остановите и запустите снова `npm run dev` или `pnpm dev`)

#### Настройка для Vercel (продакшен)

Если вашему проекту нужны переменные окружения на Vercel:
1. В веб-интерфейсе Vercel перейдите в настройки проекта
2. Откройте раздел "Environment Variables"
3. Добавьте `OPENROUTER_API_KEY` и `HUGGINGFACE_API_KEY` с теми же значениями
4. Перезапустите деплой

## Скрипты

Вы можете использовать npm или pnpm для выполнения скриптов:

**С npm:**
- `npm run dev` - запуск в режиме разработки
- `npm run build` - сборка для продакшена
- `npm run start` - запуск продакшен-сборки
- `npm run lint` - проверка кода линтером

**С pnpm:**
- `pnpm dev` - запуск в режиме разработки
- `pnpm build` - сборка для продакшена
- `pnpm start` - запуск продакшен-сборки
- `pnpm lint` - проверка кода линтером

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
