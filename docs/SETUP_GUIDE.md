# Setup and Execution Guide
## VisionForge Mobility Platform (PS 02 — Intelligent Ride Allocation)

This guide walks through configuring, running, and verifying the full-stack intelligent ride-hailing platform for **Belagavi, Karnataka, India**.

---

## 1. Prerequisites

- **Node.js**: v18+ (tested on Node v20/v24)
- **Python**: v3.10+ (tested on Python 3.13)
- **MongoDB**: (Optional — local mongod daemon or embedded MongoMemoryServer automatically boots)
- **Package Managers**: `npm`

---

## 2. Quick Start (Run All Services)

### Terminal 1: Backend API & Real-time Socket Server
```bash
cd backend
npm install
npm start
```
- **Port**: `http://localhost:5000`
- **Socket.IO Gateway**: `ws://localhost:5000`
- **Auto-Seeding**: Seeds 6 Belagavi operational sectors, demo accounts (`admin`, `passenger`, `drivers`), and vehicle records automatically.

### Terminal 2: FastAPI Machine Learning Service
```bash
cd ml-service
python -m uvicorn api.main:app --port 8000 --reload
```
- **Port**: `http://localhost:8000`
- **Docs**: `http://localhost:8000/docs`
- **Trained Model**: Pre-trained `demand_model.pkl` loaded with $R^2 = 0.9301$.
- *(Note: If FastAPI is not started, the backend automatically fails over to its embedded Scikit-learn heuristic engine without crashing).*

### Terminal 3: React Frontend (RideIQ)
```bash
cd frontend
npm install
npm run dev
```
- **Port**: `http://localhost:5173`
- Open in browser: `http://localhost:5173`

---

## 3. Demo Accounts & Credentials

All seeded accounts use password: `password123`

| Role | Email | Password | Persona & Vehicle |
| :--- | :--- | :--- | :--- |
| **Passenger** | `passenger@visionforge.com` | `password123` | Aarav Deshmukh (Frequent Belagavi commuter) |
| **Driver 1** | `driver1@visionforge.com` | `password123` | Ramesh Patil (Maruti Dzire, `KA 22 AB 1234`, 4.93 rating) |
| **Driver 2** | `driver2@visionforge.com` | `password123` | Sunil Kulkarni (Toyota Etios, `KA 22 MJ 4412`, 4.88 rating) |
| **Driver 3** | `driver3@visionforge.com` | `password123` | Santosh Jadhav (Honda Amaze, `KA 22 EF 8821`, 4.91 rating) |
| **Admin** | `admin@visionforge.com` | `password123` | Operations Center Supervisor |

> **Pro Tip**: In the Auth view, use the **⚡ 1-Click Evaluator Demo Logins** bar to sign in instantly without typing!

---

## 4. Verification & Testing

### Automated Test Suite
Run the built-in integration test suite testing all 8 mandatory workflows:
```bash
cd backend
node --test tests/api.test.js
```

### Production Build
Verify the React production build:
```bash
cd frontend
npm run build
```

---

## 5. Walkthrough Workflow for Evaluators

1. **Passenger Booking**:
   - Navigate to `Passenger App`.
   - Select Pickup: `Belagavi Central Bus Terminal (CBT)`.
   - Select Destination: `Sambra Airport (IXG)`.
   - Notice the dynamic upfront quote: distance (18.2 km), duration (28 min), and vehicle tiers (Standard, Premium, Shared with 25% discount).
   - Click **Book Ride**.

2. **Matching & Explainability**:
   - Observe the radar scanning state.
   - Inspect the **Fairness Utility Score (94.2/100)**: explainability shows how the driver was selected based on proximity, workload balance, and idle time rather than nearest distance alone.

3. **Live GPS Telemetry**:
   - Observe real-time driver coordinates animating along the Belagavi route.
   - Advance through stages (`Accepted` → `Arriving` → `Ongoing` → `Completed`).
   - Test Emergency SOS and cancellation options.

4. **Driver Console**:
   - Open `Driver Console` in a second tab or toggle role.
   - Switch Online/Offline toggle.
   - Trigger an incoming request with the **15-second countdown timer**.
   - Click **Reject**: observe the **Automatic Reassignment Engine** immediately re-route the trip to the next optimal driver without passenger disruption.

5. **Mobility Intelligence Suite**:
   - Open `Intelligence Suite` to audit all 5 Mandatory Advanced Features:
     - **Tab 1: Demand Forecasting (ML)**: Actual vs Predicted demand curves, Scikit-learn metrics ($R^2 = 0.9301$), proactive repositioning alerts.
     - **Tab 2: Zone Intelligence**: 6 Belagavi operational sectors, live supply-demand ratio, dynamic surge multipliers.
     - **Tab 3: Ride Pooling**: Shared trip pairing, feasible waypoint permutation ($P_A \to P_B \to D_A \to D_B$), detour $<15\%$, 25% passenger discount.
     - **Tab 4: Driver Fairness Utility**: Opportunity parity, variance reduced from 28% to 6.8%.
     - **Tab 5: Dynamic Reassignment**: 15s timeout dispatch and driver rejection recovery log.

