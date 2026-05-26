# ✅ TaskFlow

A modern, elegant task management application built with **PHP** and **JavaScript**.

![TaskFlow](https://img.shields.io/badge/TaskFlow-v1.0-blueviolet?style=for-the-badge)
![PHP](https://img.shields.io/badge/PHP-8.0+-777BB4?style=for-the-badge&logo=php&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

## 🚀 Features

- **Create, Read, Update, Delete** tasks with a beautiful UI
- **Priority levels** (Low, Medium, High, Critical) with color-coded badges
- **Category filtering** and search functionality
- **Due date tracking** with overdue alerts
- **Drag-and-drop** task reordering
- **Dark/Light mode** toggle
- **Responsive design** for all screen sizes
- **Smooth animations** and micro-interactions
- **LocalStorage** persistence (no database required for demo)
- **PHP REST API** backend with JSON file storage

## 📁 Project Structure

```
TaskFlow/
├── api/
│   ├── index.php          # API router
│   ├── TaskController.php # Task CRUD operations
│   └── data/
│       └── tasks.json     # JSON file storage
├── assets/
│   ├── css/
│   │   └── style.css      # Main stylesheet
│   └── js/
│       └── app.js         # Main JavaScript application
├── index.html             # Main entry point
└── README.md
```

## 🛠️ Setup

### Prerequisites
- PHP 8.0+ installed
- A modern web browser

### Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/TaskFlow.git
   cd TaskFlow
   ```

2. Start the PHP development server:
   ```bash
   php -S localhost:8000
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## 📸 Screenshots

The app features a stunning glassmorphism design with smooth animations and a premium feel.

## 🎨 Design Highlights

- **Glassmorphism** card effects with backdrop blur
- **Gradient accents** for visual hierarchy
- **Micro-animations** on hover and interaction
- **Custom scrollbar** styling
- **Premium typography** using Inter font family

## 📝 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/?action=list` | Get all tasks |
| POST | `/api/?action=create` | Create a new task |
| PUT | `/api/?action=update&id={id}` | Update a task |
| DELETE | `/api/?action=delete&id={id}` | Delete a task |

## 📄 License

This project is licensed under the MIT License.
