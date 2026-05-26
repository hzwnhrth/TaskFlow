/**
 * TaskFlow — Main JavaScript Application
 * 
 * Handles all client-side logic including task CRUD operations,
 * UI rendering, filtering, theme toggling, and toast notifications.
 */

const API_BASE = 'api/index.php';

// ─── State ───
let tasks = [];
let editingTaskId = null;
let currentFilter = { category: 'all', priority: 'all', status: 'all' };

// ─── DOM Elements ───
const taskList = document.getElementById('task-list');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('filter-category');
const priorityFilter = document.getElementById('filter-priority');
const modalOverlay = document.getElementById('modal-overlay');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const themeToggle = document.getElementById('theme-toggle');
const toastContainer = document.getElementById('toast-container');

// Stat elements
const statTotal = document.getElementById('stat-total');
const statCompleted = document.getElementById('stat-completed');
const statPending = document.getElementById('stat-pending');
const statOverdue = document.getElementById('stat-overdue');

// ─── Initialize ───
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadTasks();
    setupEventListeners();
});

// ─── Event Listeners ───
function setupEventListeners() {
    // Add task button
    document.getElementById('btn-add-task').addEventListener('click', () => openModal());

    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Search
    searchInput.addEventListener('input', debounce(filterAndRender, 300));

    // Filters
    categoryFilter.addEventListener('change', filterAndRender);
    priorityFilter.addEventListener('change', filterAndRender);

    // Modal
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // Form submit
    taskForm.addEventListener('submit', handleFormSubmit);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            openModal();
        }
    });
}

// ─── API Calls ───
async function apiCall(action, method = 'GET', data = null, id = null) {
    let url = `${API_BASE}?action=${action}`;
    if (id) url += `&id=${id}`;

    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        // Fallback to localStorage if API is not available
        return null;
    }
}

// ─── Task Operations ───
async function loadTasks() {
    const result = await apiCall('list');
    if (result && result.success) {
        tasks = result.data;
    } else {
        // Fallback: Load from localStorage
        tasks = JSON.parse(localStorage.getItem('taskflow_tasks') || '[]');
    }
    filterAndRender();
    updateStats();
}

async function createTask(taskData) {
    const result = await apiCall('create', 'POST', taskData);
    if (result && result.success) {
        tasks.push(result.data);
    } else {
        // Fallback: Create locally
        const newTask = {
            id: 'task_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
            ...taskData,
            completed: false,
            order: tasks.length,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        tasks.push(newTask);
        saveTasks();
    }
    filterAndRender();
    updateStats();
    showToast('Task created successfully!', 'success');
}

async function updateTask(id, updates) {
    const result = await apiCall('update', 'PUT', updates, id);
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        if (result && result.success) {
            tasks[index] = result.data;
        } else {
            tasks[index] = { ...tasks[index], ...updates, updated_at: new Date().toISOString() };
            saveTasks();
        }
    }
    filterAndRender();
    updateStats();
}

async function deleteTask(id) {
    const result = await apiCall('delete', 'DELETE', null, id);
    tasks = tasks.filter(t => t.id !== id);
    if (!result || !result.success) {
        saveTasks();
    }
    filterAndRender();
    updateStats();
    showToast('Task deleted', 'info');
}

function saveTasks() {
    localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
}

// ─── Filtering & Rendering ───
function filterAndRender() {
    let filtered = [...tasks];

    // Search filter
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(t =>
            t.title.toLowerCase().includes(searchTerm) ||
            (t.description && t.description.toLowerCase().includes(searchTerm))
        );
    }

    // Category filter
    const category = categoryFilter.value;
    if (category !== 'all') {
        filtered = filtered.filter(t => t.category === category);
    }

    // Priority filter
    const priority = priorityFilter.value;
    if (priority !== 'all') {
        filtered = filtered.filter(t => t.priority === priority);
    }

    renderTaskList(filtered);
}

function renderTaskList(filteredTasks) {
    if (filteredTasks.length === 0) {
        taskList.innerHTML = `
            <div class="task-list-empty">
                <div class="empty-icon">📋</div>
                <h3>No tasks found</h3>
                <p>Create your first task to get started, or adjust your filters.</p>
            </div>
        `;
        return;
    }

    // Sort: uncompleted first, then by priority
    const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
    filteredTasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    });

    taskList.innerHTML = filteredTasks.map(task => renderTaskCard(task)).join('');

    // Attach event listeners to task cards
    taskList.querySelectorAll('.task-checkbox').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const task = tasks.find(t => t.id === id);
            if (task) {
                updateTask(id, { completed: !task.completed });
                showToast(task.completed ? 'Task reopened' : 'Task completed! 🎉', 'success');
            }
        });
    });

    taskList.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => openModal(btn.dataset.id));
    });

    taskList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('Delete this task?')) {
                deleteTask(btn.dataset.id);
            }
        });
    });
}

function renderTaskCard(task) {
    const isOverdue = !task.completed && task.due_date && new Date(task.due_date) < new Date();
    const dueText = task.due_date ? formatDate(task.due_date) : '';

    return `
        <div class="task-card ${task.completed ? 'completed' : ''}" data-priority="${task.priority}" data-id="${task.id}">
            <button class="task-checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}" title="Toggle complete">
                ${task.completed ? '✓' : ''}
            </button>
            <div class="task-content">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    <span class="badge badge-priority-${task.priority}">${task.priority}</span>
                    <span class="badge badge-category">📁 ${escapeHtml(task.category || 'general')}</span>
                    ${dueText ? `<span class="badge badge-due ${isOverdue ? 'overdue' : ''}">📅 ${dueText}</span>` : ''}
                </div>
            </div>
            <div class="task-actions">
                <button class="btn-task-action btn-edit" data-id="${task.id}" title="Edit">✏️</button>
                <button class="btn-task-action delete btn-delete" data-id="${task.id}" title="Delete">🗑️</button>
            </div>
        </div>
    `;
}

// ─── Stats ───
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) < new Date()).length;

    animateValue(statTotal, total);
    animateValue(statCompleted, completed);
    animateValue(statPending, pending);
    animateValue(statOverdue, overdue);
}

function animateValue(element, target) {
    const current = parseInt(element.textContent) || 0;
    if (current === target) return;

    const duration = 400;
    const steps = 20;
    const increment = (target - current) / steps;
    let step = 0;

    const timer = setInterval(() => {
        step++;
        const value = Math.round(current + increment * step);
        element.textContent = value;
        if (step >= steps) {
            element.textContent = target;
            clearInterval(timer);
        }
    }, duration / steps);
}

// ─── Modal ───
function openModal(taskId = null) {
    editingTaskId = taskId;
    const task = taskId ? tasks.find(t => t.id === taskId) : null;

    modalTitle.textContent = task ? 'Edit Task' : 'New Task';

    document.getElementById('task-title').value = task ? task.title : '';
    document.getElementById('task-description').value = task ? (task.description || '') : '';
    document.getElementById('task-priority').value = task ? task.priority : 'medium';
    document.getElementById('task-category').value = task ? (task.category || 'general') : 'general';
    document.getElementById('task-due-date').value = task ? (task.due_date || '') : '';

    modalOverlay.classList.add('active');
    document.getElementById('task-title').focus();
}

function closeModal() {
    modalOverlay.classList.remove('active');
    editingTaskId = null;
    taskForm.reset();
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const taskData = {
        title: document.getElementById('task-title').value.trim(),
        description: document.getElementById('task-description').value.trim(),
        priority: document.getElementById('task-priority').value,
        category: document.getElementById('task-category').value,
        due_date: document.getElementById('task-due-date').value || null,
    };

    if (!taskData.title) {
        showToast('Please enter a task title', 'error');
        return;
    }

    if (editingTaskId) {
        await updateTask(editingTaskId, taskData);
        showToast('Task updated successfully!', 'success');
    } else {
        await createTask(taskData);
    }

    closeModal();
}

// ─── Theme ───
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('taskflow_theme', next);
    themeToggle.textContent = next === 'light' ? '🌙' : '☀️';
}

function loadTheme() {
    const theme = localStorage.getItem('taskflow_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
}

// ─── Toast Notifications ───
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ─── Utilities ───
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff < -1) return `${Math.abs(diff)} days ago`;
    if (diff <= 7) return `In ${diff} days`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
