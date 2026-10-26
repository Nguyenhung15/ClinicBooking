# ClinicBooking

REST API for clinic appointment booking (Node.js, Express, MongoDB).

## Project structure

```
src/
├── config/        # env & database configuration
├── controllers/   # request handlers
├── middlewares/   # error handling, auth, validation...
├── models/        # Mongoose schemas
├── routes/        # route definitions (mounted at /api)
├── services/      # business logic
├── utils/         # helpers
├── app.js         # Express app
└── server.js      # entry point
```

## Getting started

```bash
cp .env.example .env
```

### With Docker (recommended)

```bash
npm run docker:dev     # dev with hot reload + MongoDB
npm run docker:prod    # production build, detached
npm run docker:down    # stop
```

### Without Docker

```bash
npm install
npm run dev
```

Health check: `GET http://localhost:3000/api/health`
