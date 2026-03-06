# Game-X Platform

Платформа для комп'ютерного клубу **Game-X** на базі `Next.js (App Router) + MongoDB`.
Проєкт поєднує промо-сайт і робочий інструмент для бронювання, адміністрування та персоналізованого кабінету користувача.

## 1) Технологічний стек

- `Next.js 15` (App Router, Server/Client Components)
- `TypeScript` (strict mode)
- `Tailwind CSS`
- `MongoDB + Mongoose`
- `NextAuth.js` (OAuth + local credentials для dev)
- `Framer Motion`
- `Zod` (валідація API)

## 2) Ключовий функціонал

- Головна сторінка з:
  - LiveMap залу (вільні/зайняті ПК),
  - тарифами,
  - персоналізованими віджетами.
- Бронювання ПК:
  - валідація payload,
  - idempotency (`Idempotency-Key`),
  - транзакційний сценарій (з fallback для середовищ без replica set).
- Адмін-панель:
  - керування зайнятими сесіями,
  - операційні KPI,
  - фільтри/сортування/ризикові індикатори,
  - audit log (main/archive).
- Профіль користувача:
  - активні сесії,
  - історія бронювань,
  - фільтри/сортування/пошук.
- Безпека і стабільність:
  - role-based guards (`requireAuth`, `requireAdmin`),
  - rate limiting по ролях/namespace,
  - security headers через `middleware.ts`,
  - health endpoint.

## 3) Структура проєкту (скорочено)

- `app/` — сторінки та API роутери (App Router)
- `components/` — UI-компоненти
- `models/` — Mongoose моделі (`Computer`, `Booking`, `AuditLog`, `AuditLogArchive`)
- `lib/` — інфраструктурні утиліти (DB, auth guards, rate-limit, audit, responses)
- `scripts/` — smoke/QA скрипти

## 4) Вимоги

- `Node.js >= 20`
- `npm >= 10`
- доступний MongoDB (локально або в хмарі)

## 5) Налаштування середовища

Створіть файл `.env.local` в корені (мінімальний приклад):

```env
MONGODB_URI=mongodb://127.0.0.1:27017/gamex
AUTH_SECRET=change-me-very-strong-secret-123
CRON_SECRET=change-me-cron-secret

# Опційно: локальні credentials для dev
ENABLE_LOCAL_CREDENTIALS=true
DEV_ADMIN_EMAIL=admin@game-x.local
DEV_ADMIN_PASSWORD=admin12345
DEV_USER_EMAIL=user@game-x.local
DEV_USER_PASSWORD=user12345

# Опційно: список адмінів через email (comma-separated)
ADMIN_EMAILS=admin@game-x.local

# Опційно: термін життя логів (днів), за замовчуванням 30
AUDIT_LOG_RETENTION_DAYS=30
```

## 6) Запуск

Встановлення залежностей:

```bash
npm install
```

Dev режим:

```bash
npm run dev
```

Production:

```bash
npm run build
npm run start
```

## 7) Демо-доступи (dev)

- User:
  - email: `user@game-x.local`
  - password: `user12345`
- Admin:
  - email: `admin@game-x.local`
  - password: `admin12345`

Актуальні значення беруться з `.env.local`.

## 8) QA і перевірки

Базовий smoke:

```bash
npm run smoke
```

Розширений API smoke:

```bash
npm run smoke:e2e
```

Auth/UI routing smoke (user/admin):

```bash
npm run smoke:auth
```

Повний QA-прохід:

```bash
npm run qa:full
```

## 9) Основні API роутери

- `GET /api/computers` — список ПК для LiveMap
- `POST /api/bookings` — створення бронювання
- `GET /api/personalization` — персоналізований payload для user/admin
- `PATCH /api/admin/computers/:id` — завершення сесії адміном
- `GET /api/admin/audit-logs` — журнал подій (admin-only)
- `GET /api/health` — health-check
- `GET /api/cron/release-pcs` — cron завершення прострочених сесій
- `GET /api/cron/cleanup-idempotency` — cleanup старих idempotency-ключів
- `GET /api/cron/archive-audit-logs` — архівація audit логів

## 10) Принципи архітектури

- UI відділений від серверної/DB логіки.
- Базова бізнес-логіка в API шарах і `lib/`.
- Типобезпечність без `any`.
- NoSQL-підхід для MongoDB з акцентом на практичні індекси і агрегати.
- Пріоритет: надійність операцій, прозорість подій (audit), і передбачуваний UX.

