# ClinicBooking

Clinic appointment booking system, organised as a monorepo.

| Folder | Stack | Description |
|---|---|---|
| [`backend/`](backend) | Node.js, Express 5, MongoDB (Mongoose) | REST API under `/api` |
| [`web/`](web) | React 19, TypeScript, Vite | Web client |
| [`mobile/`](mobile) | React Native, TypeScript, Expo | Mobile app (iOS / Android) |

## Structure

```
ClinicBooking/
├── backend/
│   └── src/  config · controllers · middlewares · models · routes · services · utils
├── web/
│   └── src/  app · components · config · hooks · pages · services · styles · types
├── mobile/
│   └── src/  app · components · config · hooks · screens · services · types
├── docker-compose.yml        # dev: backend + web + MongoDB
└── docker-compose.prod.yml   # production overrides
```

Both frontends use the `@/` alias for `src/` and talk to the API through
`services/api.ts`.

## Environment variables

Copy the template in each app you run outside Docker:

```bash
cp backend/.env.example backend/.env
cp web/.env.example web/.env
cp mobile/.env.example mobile/.env
```

| App | Variable | Notes |
|---|---|---|
| backend | `MONGO_URI`, `PORT`, `CORS_ORIGINS` | `CORS_ORIGINS` is comma-separated |
| web | `VITE_API_URL` | e.g. `http://localhost:3000/api` |
| mobile | `EXPO_PUBLIC_API_URL` | use your machine's LAN IP, **not** `localhost` (Android emulator: `10.0.2.2`) |

## Run with Docker (backend + web + MongoDB)

```bash
docker compose up --build        # dev with hot reload
docker compose down              # stop
docker compose down -v           # stop and wipe database
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/health

Production build (nginx serves the web app on port 80):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Run the mobile app

The mobile app is **not** dockerized: Expo runs on your machine and connects to
a simulator or the Expo Go app on a physical device.

```bash
cd mobile
npm install
npm start
```

Make sure the backend is running and `EXPO_PUBLIC_API_URL` points to it.

## Run without Docker

```bash
cd backend && npm install && npm run dev
cd web     && npm install && npm run dev
```
