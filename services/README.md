# Сервисы проекта

Проект разбит на микросервисы, чтобы:
- держать файлы компактными (обычно до ~1k строк);
- группировать функции по 1 бизнес-логике;
- ускорить поиск и доработку нужного участка.

## Группы сервисов

### Данные WB
- `wb-market.service.js`
  - Снимок рынка по карточке: остатки, текущая и базовая цена.
  - Fallback-цепочка источников (`card.wb.ru` + запасные источники).
  - API: `window.WBMarketService.fetchCardMarketSnapshot(...)`.

- `wb-seller.service.js`
  - Загрузка seller-каталога постранично.
  - Нормализация nmId и извлечение остатков/цен из payload.
  - API: `window.WBSellerService.fetchSellerProducts(...)`.

### UI: таблица и оверлеи
- `ui-table.service.js`
  - Рендер строк таблицы.
  - Пагинация, фильтрация, статусные и price/stock ячейки.

- `ui-overlays.service.js`
  - Оверлеи листинга, рекомендаций, рич-контента, лимитов.
  - Переключение слайдов, миниатюры, синхронизация индексов.

- `ui-tooltips.service.js`
  - Tooltip-ы, hover zoom, подсказки и service worker registration.

### UI: фильтры и дашборд
- `ui-controls-filters.service.js`
  - Глобальные/колоночные фильтры.
  - Лимиты автоплея/тегов по кабинетам.
  - Управление блоками фильтра и контролов.

- `app-controls.service.js`
  - Обработчики действий пользователя:
    - массовое обновление/обновление проблемных;
    - лимиты и пагинация;
    - управление кабинетами (seller settings modal).

- `ui-problems.service.js`
  - Сводка проблем.
  - Быстрые фильтры по кабинетам/категориям.
  - Расчеты breakdown по типам проблем.

- `ui-dashboard.service.js`
  - Маркетинговый дашборд.
  - Карточки метрик и пресеты проблемных фильтров.
  - Группировка и отчет по ошибкам загрузки.

### Общие утилиты
- `parser-utils.service.js`
  - Парсинг bulk-ввода.
  - Извлечение nmId и ссылок из rich/recommendations.

- `app-runtime-utils.service.js`
  - Общие runtime-утилиты:
    - storage/persist/restore;
    - `runWithConcurrency`;
    - escape/base64 и URL helpers;
    - синхронизация состояний кнопок.

## Точка сборки

`app.js` — orchestration-слой:
- инициализация приложения;
- bind событий;
- точка входа и связывание сервисов.

Текущая цель по размеру соблюдена:
- `app.js` ~700 строк (вместо ~6k).
- Сервисные файлы в основном до ~1k строк, разбиты по ответственности.

## Порядок подключения

Скрипты подключаются в `index.html` до `app.js`:
1. `./services/wb-market.service.js`
2. `./services/ui-tooltips.service.js`
3. `./services/ui-controls-filters.service.js`
4. `./services/parser-utils.service.js`
5. `./services/wb-card-loader.service.js`
6. `./services/app-controls.service.js`
7. `./services/ui-table.service.js`
8. `./services/ui-problems.service.js`
9. `./services/ui-dashboard.service.js`
10. `./services/ui-overlays.service.js`
11. `./services/app-runtime-utils.service.js`
12. `./app.js`
