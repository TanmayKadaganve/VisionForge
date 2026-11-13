# Database Schema Specification
## VisionForge Mobility Platform (PS 02)

Database: `visionforge_ride` (MongoDB 7.0 / MongoMemoryServer fallback)

All spatial coordinates use GeoJSON `Point` format `[longitude, latitude]` with MongoDB `2dsphere` geospatial indexing.

---

## 1. Schema Entity Relationship

```mermaid
erDiagram
    USER ||--o{ DRIVER : "operates as"
    USER ||--o{ RIDE : "books"
    DRIVER ||--o{ VEHICLE : "assigned"
    DRIVER ||--o{ RIDE : "executes"
    RIDE ||--o{ RIDE_ASSIGNMENT : "tracked by"
    RIDE ||--o{ RIDE_EVENT : "audit log"
    ZONE ||--o{ RIDE : "contains pickup/drop"
    POOLING_GROUP ||--o{ RIDE : "groups shared trips"

    USER {
        ObjectId _id PK
        string name
        string email UK
        string phone UK
        string passwordHash
        string role "passenger | driver | admin"
        number rating
        object wallet
    }

    DRIVER {
        ObjectId _id PK
        ObjectId userId FK
        ObjectId vehicleId FK
        string licenseNumber UK
        boolean isOnline
        boolean isAvailable
        object currentLocation "GeoJSON Point 2dsphere"
        string currentZone
        number acceptanceRate
        number todayRidesCount
        number rating
    }

    VEHICLE {
        ObjectId _id PK
        ObjectId driverId FK
        string model
        string plateNumber UK
        string category "Economy | Premium | XL"
        string color
        number capacity
    }

    RIDE {
        ObjectId _id PK
        string rideCode UK
        ObjectId passengerId FK
        ObjectId driverId FK
        object pickup "address, coordinates GeoJSON, zoneCode"
        object destination "address, coordinates GeoJSON, zoneCode"
        string status "REQUESTED | ACCEPTED | ARRIVING | ONGOING | COMPLETED | CANCELLED"
        string vehicleCategory
        boolean isPooled
        object fare "baseFare, distanceCharge, surgeAmount, finalFare"
        object allocationFairness "selectedDriverId, fairnessScore, explanation"
        number pickupEtaMinutes
        number reassignmentAttempts
    }

    ZONE {
        ObjectId _id PK
        string code UK
        string name
        object center "GeoJSON Point"
        object polygon "GeoJSON Polygon"
        number currentDemand
        number availableDrivers
        number surgeMultiplier
        string classification "LOW | BALANCED | HIGH | CRITICAL"
    }

    RIDE_ASSIGNMENT {
        ObjectId _id PK
        ObjectId rideId FK
        ObjectId driverId FK
        string status "OFFERED | ACCEPTED | REJECTED | TIMED_OUT | CANCELLED"
        number attemptNumber
        number utilityScore
        date offeredAt
        date respondedAt
    }

    RIDE_EVENT {
        ObjectId _id PK
        ObjectId rideId FK
        string eventType "REQUESTED | OFFERED | TIMEOUT | REASSIGNED | ACCEPTED | COMPLETED"
        string actorRole "PASSENGER | DRIVER | SYSTEM | ADMIN"
        object payload
        date createdAt
    }
```

---

## 2. Geospatial Indexing

The following collections feature 2dsphere indexes for ultra-fast spatial search:
- `Driver.currentLocation`: `{ currentLocation: "2dsphere" }`
- `Ride.pickup.location`: `{ "pickup.location": "2dsphere" }`
- `Zone.center`: `{ center: "2dsphere" }`
- `Zone.polygon`: `{ polygon: "2dsphere" }`

