# VeloSync Background Simulator

This service runs in the background and simulates an ESP32 device for bicycles that have an active trip. It does not change the frontend experience and is only intended to interact with the existing backend APIs.

## Setup

1. Copy `.env.example` to `.env`.
2. Point `SIMULATOR_API_URL` at the backend API base URL.
3. Run:

```bash
npm install
npm start
```

The simulator polls the existing backend for active trips and then emits telemetry toward the backend until the trip is completed or cancelled.
