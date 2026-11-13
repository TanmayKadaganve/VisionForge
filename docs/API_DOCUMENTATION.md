# API Documentation
## VisionForge Mobility Platform (PS 02)

Base URL: `http://localhost:5000/api`

All authenticated endpoints require an `Authorization: Bearer <JWT_TOKEN>` header.

---

## 1. Authentication Endpoints (`/auth`)

### `POST /auth/login`
Authenticates a user by email/phone and password.
- **Request Body**:
```json
{
  "loginId": "passenger@visionforge.com",
  "password": "password123"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "6734c2...",
    "name": "Aarav Deshmukh",
    "email": "passenger@visionforge.com",
    "role": "passenger"
  }
}
```

### `POST /auth/register/passenger`
Registers a new passenger account.
- **Request Body**: `{ name, email, phone, password }`

### `POST /auth/register/driver`
Registers a new driver and creates associated vehicle record.
- **Request Body**: `{ name, email, phone, password, licenseNumber, vehicleModel, plateNumber, vehicleCategory }`

### `GET /auth/me` (Protected)
Returns the active authenticated user profile and driver metadata if applicable.

---

## 2. Ride Management Endpoints (`/rides`)

### `POST /rides/quote` (Public)
Calculates dynamic upfront fares, distance, and duration with zone surge.
- **Request Body**:
```json
{
  "pickupCoordinates": [74.5165, 15.8497],
  "destinationCoordinates": [74.6180, 15.8590],
  "pickupAddress": "Belagavi Central Bus Terminal (CBT)",
  "destinationAddress": "Sambra Airport (IXG)"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "route": {
    "distanceKm": 18.2,
    "durationMinutes": 28,
    "source": "OSRM_ROUTING"
  },
  "zone": {
    "code": "ZONE_CENTRAL",
    "name": "Sector 1: Central Commercial",
    "surgeMultiplier": 1.5,
    "surgeReason": "High demand in CBT market sector"
  },
  "quotes": {
    "Economy": { "baseFare": 45, "finalFare": 284 },
    "Premium": { "baseFare": 75, "finalFare": 412 },
    "XL": { "baseFare": 110, "finalFare": 580 }
  },
  "poolingQuote": {
    "baseFare": 45,
    "finalFare": 213,
    "poolingDiscount": 71
  }
}
```

### `POST /rides/request` (Protected: Passenger)
Submits a ride request and triggers intelligent driver matching.
- **Request Body**:
```json
{
  "pickup": {
    "address": "Belagavi Central Bus Terminal (CBT)",
    "coordinates": [74.5165, 15.8497],
    "zoneCode": "ZONE_CENTRAL"
  },
  "destination": {
    "address": "Sambra Airport (IXG)",
    "coordinates": [74.6180, 15.8590],
    "zoneCode": "ZONE_EAST_SAMBRA"
  },
  "vehicleCategory": "Economy",
  "isPooled": false,
  "paymentMethod": "UPI"
}
```
- **Response (201 Created)**: Returns populated `ride` and `matchingResult` with candidate ranking.

### `POST /rides/:rideId/accept` (Protected: Driver)
Driver accepts the incoming trip request within 15 seconds.

### `POST /rides/:rideId/reject` (Protected: Driver)
Driver rejects the request, instantly triggering automatic reassignment.

### `PATCH /rides/:rideId/status` (Protected)
Advances trip lifecycle: `ACCEPTED` → `ARRIVING` → `ONGOING` → `COMPLETED`.

### `POST /rides/:rideId/cancel` (Protected)
Cancels active trip and records cancellation reasons.

---

## 3. Machine Learning & Zone Intelligence (`/ml`)

### `GET /ml/forecast`
Fetches predictive demand forecasting from Scikit-learn model across Belagavi sectors.
- **Query Params**: `?hour=18&zoneCode=ZONE_CENTRAL`
- **Response (200 OK)**:
```json
{
  "status": "success",
  "source": "FASTAPI_SCIKIT_LEARN",
  "modelEvaluation": {
    "r2Score": 0.9301,
    "mae": 1.422,
    "rmse": 1.797,
    "modelType": "GradientBoostingRegressor"
  },
  "forecasts": [...],
  "hourlyTrends": [...]
}
```

### `GET /ml/zones`
Returns real-time analytics for all 6 Belagavi operational sectors, active requests, available supply, and dynamic surge multipliers.

### `GET /ml/pooling`
Returns candidate ride-pooling pairings with waypoint permutations, overlap %, detour minutes, and 25% discount calculations.

### `GET /ml/allocation-comparison`
Computes comparative audit of Multi-Factor Fairness Utility dispatch versus Nearest-Driver baseline.

---

## 4. Driver Console Endpoints (`/driver`)

### `GET /driver/dashboard` (Protected: Driver)
Returns current driver status, earnings, ratings, and active ride if present.

### `POST /driver/availability` (Protected: Driver)
Toggles online/offline availability: `{ "isOnline": true }`.

### `POST /driver/location` (Protected: Driver)
Broadcasts live GPS telemetry: `{ "coordinates": [74.5165, 15.8497], "heading": 90, "speed": 35 }`.

---

## 5. Operations & Admin Endpoints (`/admin`)

### `GET /admin/overview` (Protected: Admin)
Returns platform-wide fleet KPIs: total passengers, active drivers, online count, active rides, completed rides, and total GMV revenue.

### `GET /admin/drivers` (Protected: Admin)
Returns the roster of all registered drivers with vehicle details, verification status, and ratings.

### `GET /admin/exceptions` (Protected: Admin)
Returns the timeline audit of 15s driver response timeouts, rejections, and auto-reassignments.

