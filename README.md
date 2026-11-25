# CivicConnect — AI-Driven Public Grievance & Municipal Oversight Platform

CivicConnect is a full-stack public grievance management platform connecting citizens with municipal administrators and hierarchical government authorities (**Village / City President → Taluk Officer → District Collector**).

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS, Lucide Icons, Leaflet Maps, jsPDF, SheetJS (`xlsx`), html2canvas
- **Backend:** Node.js, Express 5, built-in `node:sqlite` (`data/civicconnect.db`), HMAC-SHA256 JWT Auth + `scrypt` password hashing
- **AI Module:** Server-side Google Gemini integration (`@google/genai`) when `GEMINI_API_KEY` is configured, with a clearly labelled deterministic **Demo AI Mode** fallback when no API key is present

## How to Run

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Optional: Enable Live Gemini AI**
   Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   AUTH_SECRET=your_random_secret_here
   ```
   If `GEMINI_API_KEY` is omitted, CivicConnect automatically runs in clearly labelled **Demo AI Mode**.

3. **Development Mode (API + Vite Dev Server)**
   ```bash
   npm run dev:all
   ```
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:5050`

4. **Production Build & Single-Port Server**
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```
   Open `http://localhost:5050` in your browser.

## Demo Portal Credentials

- **Citizen Portal (`/login/citizen`):**
  - `user@civic.gov` / `password`
  - `rahul.citizen@civic.tn` / `Citizen@2026`
- **Admin Portal (`/login/admin`):**
  - `admin@civic.gov` / `admin123`
- **Government Authority Portal (`/login/authority`):**
  - Tier 1 (Village / City President): `president@civicconnect.gov.in` / `President@123` (or `president.royapettah@tn.gov` / `PresRoy@2026`)
  - Tier 2 (Taluk Officer): `taluk@civicconnect.gov.in` / `Taluk@123` (or `taluk.madurai@tn.gov` / `TalukMad@2026`)
  - Tier 3 (District Collector): `collector@civicconnect.gov.in` / `Collector@123` (or `collector.coimbatore@tn.gov` / `Coimb@2026`)
