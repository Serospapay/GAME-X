# Game-X — журнал розробки

## 1. Короткий опис проєкту

`Game-X` — це гібридний вебзастосунок для комп'ютерного клубу: одночасно промо-сайт і робоча система бронювання.  
На публічній частині користувач бачить живу карту залу, тарифи, швидкі CTA та загальну атмосферу бренду.  
На прикладній частині він може авторизуватись, бронювати ПК, дивитись активні/завершені сесії, а адміністратор — керувати залом у реальному часі.

Головна задача проєкту: зробити продукт, який виглядає сучасно і "продає", але при цьому не ламається під навантаженням реальних дій (бронювання, завершення сесій, cron-обробка, аудит дій, ролі доступу).

## 2. Стек технологій

- **Next.js 15 (App Router)** — SSR/Server Components, зручна маршрутизація, API routes в одному кодбейсі.
- **TypeScript (strict)** — критично для бізнес-логіки бронювань і ролей, щоб не ловити "тихі" помилки.
- **Tailwind CSS** — швидка верстка, контроль стилю, темізація через CSS variables.
- **MongoDB + Mongoose** — гнучка NoSQL-модель для ПК, бронювань, аудит-логів.
- **NextAuth.js** — авторизація (OAuth + local credentials для dev-сценаріїв).
- **Zod** — валідація API-входів на критичних маршрутах.
- **Framer Motion** — мікроанімації там, де вони реально покращують UX (карта, переходи, стани).
- **Sonner** — зручні toast-нотифікації на клієнті.

## 3. Архітектура

Ключове рішення: розвести UI і серверну логіку по ролях відповідальності.

- `app/*` і `components/*` відповідають за відображення.
- `app/api/*` відповідає за бізнес-операції та доступ до MongoDB.
- `models/*` містять схеми й індекси даних.
- `lib/*` — інфраструктурні речі: guards, rate limit, API response helpers, audit writing.

Тобто UI не "винаходить" правила на місці: усі чутливі перевірки (валідація, роль, обмеження запитів, транзакції) проходять через серверний шар. Це дозволило не тільки стабілізувати функціонал, а й зробити його передбачуваним для тестування.

## 4. Структура проєкту

```txt
Gabor/
├── app/
│   ├── page.tsx                         # Головна (Hero + LiveMap + тарифи + персоналізація)
│   ├── profile/page.tsx                 # Кабінет користувача
│   ├── admin/page.tsx                   # Адмін-панель
│   ├── auth/signin/page.tsx             # Авторизація
│   └── api/
│       ├── bookings/route.ts            # Створення бронювання
│       ├── computers/route.ts           # Список ПК для LiveMap
│       ├── personalization/route.ts     # User/Admin персоналізація
│       ├── health/route.ts              # Health check
│       ├── admin/
│       │   ├── computers/[id]/route.ts  # Admin release сесії
│       │   └── audit-logs/route.ts      # Audit API (main/archive)
│       ├── cron/
│       │   ├── release-pcs/route.ts
│       │   ├── cleanup-idempotency/route.ts
│       │   └── archive-audit-logs/route.ts
│       ├── auth/[...nextauth]/route.ts
│       ├── seed/route.ts
│       └── tariffs/route.ts
├── components/
│   ├── LiveMap.tsx
│   ├── BookingModal.tsx
│   ├── CountdownTimer.tsx
│   ├── PersonalizedHomePanel.tsx
│   ├── AdminPCAction.tsx
│   ├── ConfirmModal.tsx
│   ├── AppHeader.tsx / AppFooter.tsx
│   ├── AuthButton.tsx
│   └── ThemeProvider.tsx / ThemeToggle.tsx
├── models/
│   ├── Computer.ts
│   ├── Booking.ts
│   ├── AuditLog.ts
│   └── AuditLogArchive.ts
├── lib/
│   ├── mongodb.ts
│   ├── auth-guard.ts
│   ├── rate-limit.ts
│   ├── rate-limit-policy.ts
│   ├── api-response.ts
│   └── audit-log.ts
└── scripts/
    ├── smoke.mjs
    ├── smoke-e2e.mjs
    ├── smoke-auth.mjs
    └── qa-full.mjs
```

## 5. Хронологія розробки

---

### Етап 1: Підняття фундаменту (Tailwind, базовий App Router, Mongo connection)

На старті головний ризик був не у "фічах", а в стабільності бази: без коректного підключення Tailwind і Mongo все інше не мало сенсу.  
Тому спочатку закрили інфраструктуру: `globals.css`, `tailwind.config.ts`, `postcss.config.mjs`, імпорт стилів у layout, централізоване кешоване підключення до MongoDB.

**Код:**

```ts
// lib/mongodb.ts (фрагмент)
const rawUri = process.env.MONGODB_URI;
if (!rawUri) {
  throw new Error("Будь ласка, визначте змінну MONGODB_URI у файлі .env.local");
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) cached.promise = mongoose.connect(rawUri);
  cached.conn = await cached.promise;
  return cached.conn;
}
```

**Пояснення:** на dev/HMR без кешу з'єднань дуже легко вбити пул підключень і отримати хаотичні помилки. Тому connection cache був не "опцією", а обов'язковою умовою.

---

### Етап 2: Бойова авторизація з ролями (user/admin)

OAuth ключі часто відсутні в локальному середовищі, тож додали `CredentialsProvider` для dev-режиму, щоб можна було реально тестувати user/admin потоки без зовнішніх сервісів.

**Код:**

```ts
// auth.ts (фрагмент)
if (enableLocalCredentials) {
  providers.push(
    CredentialsProvider({
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (email === devAdminEmail.toLowerCase() && password === devAdminPassword) {
          return { id: "dev-admin-user", name: "Demo Admin", email: devAdminEmail };
        }
        if (email === devUserEmail.toLowerCase() && password === devUserPassword) {
          return { id: "dev-regular-user", name: "Demo User", email: devUserEmail };
        }
        return null;
      },
    })
  );
}
```

**Пояснення:** це рішення прискорило реальний e2e цикл: можна одразу перевіряти UI/доступи без "ручної магії" через сторонні провайдери.

---

### Етап 3: LiveMap + бронювання як наскрізний сценарій

Критичний сценарій проєкту — відображення стану ПК і бронювання без перезавантаження.  
Зробили `LiveMap` клієнтським, а серверні маршрути — транзакційними, з конкурентною безпекою.

**Код:**

```ts
// app/api/bookings/route.ts (фрагмент)
const computer = await Computer.findOneAndUpdate(
  { _id: computerObjectId, status: "вільний" },
  { status: "зайнятий" },
  { new: true, session: sessionTx }
).lean();
```

**Пояснення:** атомарний `findOneAndUpdate` по `status: "вільний"` захищає від подвійного бронювання одного місця при одночасних кліках.

---

### Етап 4: Транзакції + idempotency + rollback поведінка

Після базової роботи бронювань закрили біль:
- повторні кліки/ретраї,
- частково застосовані зміни,
- різні режими Mongo (з/без replica set).

**Код:**

```ts
// app/api/bookings/route.ts (фрагмент)
if (idempotencyKey) {
  const existing = await Booking.findOne({ idempotencyKey }).lean();
  if (existing) {
    return ok({ success: true, idempotentReplay: true, bookingId: existing._id.toString() });
  }
}
```

**Пояснення:** `Idempotency-Key` прибрав дублікати бронювання при повторному submit. А fallback після `withTransaction` дозволив коректно працювати навіть у локальних середовищах без повної транзакційної підтримки.

---

### Етап 5: Адмін-операції і контроль ризиків

Адмінка еволюціонувала з "простого списку" в справжній операційний екран:
- KPI по залу,
- ризикові стани сесій (прострочено/критично/скоро),
- фільтри/пошук/сортування,
- швидке завершення сесії.

**Код:**

```ts
// app/admin/page.tsx (фрагмент)
if (endingFilter === "overdue") return row.diffMinutes < 0;
if (endingFilter === "critical") return row.diffMinutes >= 0 && row.diffMinutes <= 15;
if (endingFilter === "soon") return row.diffMinutes > 15 && row.diffMinutes <= 60;
```

**Пояснення:** це дало адміну реальний пріоритетний список дій, а не просто "таблицю заради таблиці".

---

### Етап 6: Персоналізація профілю для користувача

Профіль переробили у повноцінний кабінет:
- метрики,
- активні сесії зі статусом часу,
- історія з пошуком/періодами/сортуванням,
- швидкі переходи на карту й головну.

**Код:**

```ts
// app/profile/page.tsx (фрагмент)
const completedView = completedBookings
  .filter(/* query + period */)
  .sort(/* end or amount */);
```

**Пояснення:** користувач бачить не "лог JSON", а зрозумілу картину власної активності.

---

### Етап 7: Security hardening (guards, rate-limit, headers)

Закрили серверний периметр:
- `requireAuth` / `requireAdmin`,
- role-aware rate limit policy,
- security headers у `middleware.ts`.

**Код:**

```ts
// middleware.ts (фрагмент)
response.headers.set("X-Frame-Options", "DENY");
response.headers.set("X-Content-Type-Options", "nosniff");
response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
```

**Пояснення:** це базова гігієна для production, яка прибирає зайві вектори атак ще до входу в бізнес-логіку.

---

### Етап 8: Audit trail і архівація подій

Щоб мати прозору операційну історію:
- ввели `AuditLog`,
- додали `AuditLogArchive`,
- зробили API перегляду main/archive,
- підключили cron-архівацію і TTL.

**Код:**

```ts
// models/AuditLog.ts (фрагмент)
AuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

**Пояснення:** робочий журнал є, але без нескінченного росту колекції.

---

### Етап 9: QA pipeline і smoke сценарії

Щоб не перевіряти "на око", додали декілька шарів smoke:
- API smoke,
- auth/role smoke,
- зведений `qa:full`.

**Код:**

```json
// package.json (фрагмент)
"scripts": {
  "smoke": "node scripts/smoke.mjs",
  "smoke:e2e": "node scripts/smoke-e2e.mjs",
  "smoke:auth": "node scripts/smoke-auth.mjs",
  "qa:full": "node scripts/qa-full.mjs"
}
```

**Пояснення:** це прибрало "суб'єктивну впевненість". Є відтворюваний контроль якості перед релізом.

---

### Етап 10: Чистка рудиментів і стабілізація фінальної структури

Після кількох ітерацій дизайну/UX у `components` залишився старий шар невикористаних файлів.  
Його видалили, щоб не збивати команду і не тягнути "мертвий код" далі.

**Що прибрали:** старі `Hero*`, `QuickActions`, `LiveStatsBar`, `Tariffs*` компоненти попередніх дизайнів.

**Результат:** кодова база стала компактнішою, а підтримка — простішою.

## 6. Основні компоненти сайту (як працюють між собою)

- **`app/page.tsx`** — композиційний вхід: Hero-частина, Quick cards, `LiveMap`, тарифи, `PersonalizedHomePanel`.
- **`components/LiveMap.tsx`** — інтерактивна карта станів ПК, відкриває `BookingModal`, працює з `/api/computers` та `/api/bookings`.
- **`components/BookingModal.tsx`** — збирає дані бронювання, відправляє POST, обробляє результати/помилки.
- **`app/profile/page.tsx`** — персональний кабінет із runtime-метриками й історією.
- **`app/admin/page.tsx`** — операційний центр адміністратора.
- **`app/api/*`** — серверний контур домену (bookings/computers/admin/cron/health/personalization).
- **`models/*`** — структура даних та індекси.
- **`lib/*`** — технічний "клей": guard, rate-limit, audit, helpers.

## 7. Висновок

Проєкт пройшов шлях від "зробити красиву головну" до повноцінної продуктної системи з:
- продуманим UX для різних ролей,
- захищеним серверним шаром,
- аудитом операцій,
- передбачуваним QA-процесом.

Якщо коротко, вийшла не просто вітрина, а робочий інструмент клубу, який можна розвивати далі без переписування з нуля.

