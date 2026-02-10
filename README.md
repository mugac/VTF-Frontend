# VTF - Volatility Forensics Platform

Frontend aplikace pro analýzu memory dumpů pomocí Volatility Framework.

## 🚀 Technologie

- **React 19** - UI knihovna
- **TypeScript** - Typovaný JavaScript
- **Vite** - Build nástroj a dev server
- **Tailwind CSS** - Utility-first CSS framework
- **AG Grid** - Pokročilá datová tabulka
- **Axios** - HTTP klient pro API komunikaci

## 📋 Požadavky

- Node.js 18+ 
- npm nebo yarn
- Backend API běžící na portu 8000 (nebo upravte `.env`)

## 🛠️ Instalace

```bash
npm install
```

## ⚙️ Konfigurace

Upravte soubor `.env` pro nastavení API URL:

```env
VITE_API_URL=http://localhost:8000
```

## 🏃 Spuštění

Vývojový server:
```bash
npm run dev
```

Aplikace poběží na `http://localhost:5173`

Build pro produkci:
```bash
npm run build

uvicorn app.main:app --reload
```

## 📁 Struktura projektu

```
src/
├── api/
│   └── vtfApi.ts           # API komunikace s backendem
├── components/
│   ├── UploadForm.tsx      # Formulář pro nahrání souboru
│   └── ResultsGrid.tsx     # AG Grid tabulka s výsledky
├── App.tsx                 # Hlavní komponenta s řízením stavů
├── main.tsx                # Entry point
└── index.css               # Globální styly
```

## 🔄 Workflow aplikace

1. **Upload** - Uživatel nahraje memory dump soubor
2. **Processing** - Backend analyzuje soubor, frontend polluje stav každé 2 sekundy
3. **Results** - Po dokončení se zobrazí výsledky v AG Grid tabulce

## 🔌 Backend API

Aplikace očekává následující endpointy:

- `POST /api/v1/upload` - Nahrání souboru
  - Input: `multipart/form-data` s polem `file`
  - Output: `{ "analysis_id": "string" }`

- `GET /api/v1/status/{analysis_id}` - Kontrola stavu
  - Output: `{ "status": "in_progress" | "completed" }`

- `GET /api/v1/results/{analysis_id}` - Získání výsledků
  - Output: `Array<Object>` (pole JSON objektů)

## 🎨 Features

- ✅ Upload memory dump souborů s progress indikátorem
- ✅ Real-time sledování stavu analýzy
- ✅ Automatické zobrazení výsledků po dokončení
- ✅ Plně responzivní AG Grid tabulka s:
  - Třídění sloupců
  - Filtrování
  - Stránkování
  - Změna velikosti sloupců
- ✅ Error handling a validace
- ✅ Možnost nahrát nový soubor po dokončení

## 📝 TODO pro budoucí rozšíření

- [ ] Přidat podporu více pluginů Volatility
- [ ] Export výsledků (CSV, JSON, Excel)
- [ ] Historie analýz
- [ ] WebSocket notifikace místo pollingu
- [ ] Dark mode
- [ ] Autentizace a uživatelské role

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
