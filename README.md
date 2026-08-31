# 🚲 VeloSync – Smart Geolocation-Based IoT Bicycle Sharing Platform

## 📖 Project Overview

**VeloSync** is a smart, map-based **Progressive Web App (PWA)** for bicycle sharing.

It allows users to find, reserve, unlock, ride, and return bicycles using **virtual geofenced stations** without requiring expensive physical docking stations.

The project combines **web technology, geolocation, IoT, and spatial databases** to provide a secure and efficient bicycle-sharing system.

---

## ✨ Key Features

* 📍 **Virtual Geofencing** – Defines authorized bicycle parking areas.
* 🔵 **Offline Web Bluetooth** – Allows communication with the bicycle through BLE when internet connectivity is unavailable.
* 🚲 **Smart Bicycle Sharing** – Find, reserve, unlock, and return bicycles.
* 🔄 **Fleet Rebalancing** – Encourages users to move bicycles between stations using rewards.
* 📱 **Progressive Web App** – Works directly through a web browser without requiring a traditional app installation.
* 🔐 **Secure Authentication** – Uses JWT-based authentication.
* ⚡ **Concurrency Control** – Prevents multiple users from booking the same bicycle.

---

## 🛠️ Technology Stack

| Category       | Technologies                      |
| -------------- | --------------------------------- |
| Frontend       | React.js, React-Leaflet, PWA      |
| Backend        | Node.js, Express.js               |
| Database       | PostgreSQL, PostGIS               |
| Authentication | JWT                               |
| IoT            | ESP32                             |
| GPS            | NEO-6M                            |
| Cellular       | SIM7000G                          |
| Lock           | 5V Solenoid Lock                  |
| Bluetooth      | Web Bluetooth API                 |
| Tools          | VS Code, Arduino IDE, Git, GitHub |

---

## 🏗️ Basic Architecture

```text
User
 ↓
React PWA
 ↓
Node.js + Express.js
 ↓
PostgreSQL + PostGIS
 ↓
IoT Bicycle
 ↓
ESP32 + GPS + BLE + Lock
```

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd VeloSync
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Database

Install PostgreSQL and enable PostGIS:

```sql
CREATE EXTENSION postgis;
```

Then run the project's database SQL files.

---

## 📂 Project Structure

```text
VeloSync/
│
├── frontend/
├── backend/
├── database/
├── hardware/
├── docs/
├── .gitignore
└── README.md
```

---

## 🎯 Project Objectives

* Develop a smart bicycle-sharing platform.
* Use geolocation for virtual bicycle stations.
* Provide secure bicycle locking and unlocking.
* Reduce dependency on physical docking stations.
* Support bicycle sharing through a PWA.
* Improve bicycle distribution using smart rebalancing.

---

## 🔮 Future Scope

* Online payment integration
* Push notifications
* AI-based demand prediction
* Advanced fleet management
* Real-time bicycle monitoring
* Multi-city support

---

## 👨‍💻 Project

**VeloSync – Smart Geolocation-Based IoT Bicycle Sharing Platform**

Developed as an academic project using modern web, database, and IoT technologies.

---

## ⭐ Vision

> **Smart Mobility. Virtual Stations. Connected Bicycles.**
