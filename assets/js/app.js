/**
 * TaskFlow — Main Application
 */

const API_BASE = 'api/index.php';

let tasks = [];
let editingTaskId = null;

const taskList = document.getElementById('task-list');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('filter-category');
const priorityFilter = document.getElementById('filter-priority');
const modalOverlay = document.getElementById('modal-overlay');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const themeToggle = document.getElementById('theme-toggle');
const toastContainer = document.getElementById('toast-container');
const statTotal = document.getElementById('stat-total');
const statCompleted = document.getElementById('stat-completed');
const statPending = document.getElementById('stat-pending');
const statOverdue = document.getElementById('stat-overdue');

// SVG icon templates
const icons = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>',
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
};

document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadTasks();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('btn-add-task').addEventListener('click', () => openModal());
    themeToggle.addEventListener('click', toggleTheme);
    searchInput.addEventListener('input', debounce(filterAndRender, 300));
    categoryFilter.addEventListener('change', filterAndRender);
    priorityFilter.addEventListener('change', filterAndRender);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    taskForm.addEventListener('submit', handleFormSubmit);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'n' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openModal(); }
    });
}

// ─── API ───
async function apiCall(action, method = 'GET', data = null, id = null) {
    let url = `${API_BASE}?action=${action}`;
    if (id) url += `&id=${id}`;
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (data && method !== 'GET') options.body = JSON.stringify(data);
    try {
        const response = await fetch(url, options);
        return await response.json();
    } catch { return null; }
}

// ─── CRUD ───
async function loadTasks() {
    const result = await apiCall('list');
    if (result && result.success) {
        tasks = result.data;
    } else {
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
        const newTask = {
            id: 'task_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
            ...taskData, completed: false, order: tasks.length,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        tasks.push(newTask);
        saveTasks();
    }
    filterAndRender();
    updateStats();
    showToast('Task created successfully', 'success');
}

async function updateTask(id, updates) {
    const result = await apiCall('update', 'PUT', updates, id);
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
        tasks[index] = result && result.success ? result.data : { ...tasks[index], ...updates, updated_at: new Date().toISOString() };
        if (!result || !result.success) saveTasks();
    }
    filterAndRender();
    updateStats();
}

async function deleteTask(id) {
    await apiCall('delete', 'DELETE', null, id);
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    filterAndRender();
    updateStats();
    showToast('Task deleted', 'info');
}

function saveTasks() { localStorage.setItem('taskflow_tasks', JSON.stringify(tasks)); }

// ─── Filter & Render ───
function filterAndRender() {
    let filtered = [...tasks];
    const term = searchInput.value.toLowerCase().trim();
    if (term) filtered = filtered.filter(t => t.title.toLowerCase().includes(term) || (t.description && t.description.toLowerCase().includes(term)));
    const cat = categoryFilter.value;
    if (cat !== 'all') filtered = filtered.filter(t => t.category === cat);
    const pri = priorityFilter.value;
    if (pri !== 'all') filtered = filtered.filter(t => t.priority === pri);
    renderTaskList(filtered);
}

function renderTaskList(filteredTasks) {
    if (filteredTasks.length === 0) {
        taskList.innerHTML = `<div class="task-list-empty"><div class="empty-icon">${icons.clipboard}</div><h3>No tasks found</h3><p>Create a task to get started, or adjust your filters.</p></div>`;
        return;
    }
    const pw = { critical: 4, high: 3, medium: 2, low: 1 };
    filteredTasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (pw[b.priority] || 0) - (pw[a.priority] || 0);
    });
    taskList.innerHTML = filteredTasks.map(t => renderTaskCard(t)).join('');

    taskList.querySelectorAll('.task-checkbox').forEach(btn => {
        btn.addEventListener('click', () => {
            const task = tasks.find(t => t.id === btn.dataset.id);
            if (task) {
                updateTask(btn.dataset.id, { completed: !task.completed });
                showToast(task.completed ? 'Task reopened' : 'Task completed', 'success');
            }
        });
    });
    taskList.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.id)));
    taskList.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => { if (confirm('Delete this task?')) deleteTask(btn.dataset.id); }));
}

function renderTaskCard(task) {
    const isOverdue = !task.completed && task.due_date && new Date(task.due_date) < new Date();
    const dueText = task.due_date ? formatDate(task.due_date) : '';
    return `
        <div class="task-card ${task.completed ? 'completed' : ''}" data-priority="${task.priority}" data-id="${task.id}">
            <button class="task-checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}" title="Toggle complete">${task.completed ? '✓' : ''}</button>
            <div class="task-content">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    <span class="badge badge-priority-${task.priority}">${task.priority}</span>
                    <span class="badge badge-category">${escapeHtml(task.category || 'general')}</span>
                    ${dueText ? `<span class="badge badge-due ${isOverdue ? 'overdue' : ''}">${dueText}</span>` : ''}
                </div>
            </div>
            <div class="task-actions">
                <button class="btn-task-action btn-edit" data-id="${task.id}" title="Edit">${icons.edit}</button>
                <button class="btn-task-action delete btn-delete" data-id="${task.id}" title="Delete">${icons.trash}</button>
            </div>
        </div>`;
}

// ─── Stats ───
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const overdue = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) < new Date()).length;
    statTotal.textContent = total;
    statCompleted.textContent = completed;
    statPending.textContent = total - completed;
    statOverdue.textContent = overdue;
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
    setTimeout(() => document.getElementById('task-title').focus(), 100);
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
    if (!taskData.title) { showToast('Please enter a task title', 'error'); return; }
    if (editingTaskId) {
        await updateTask(editingTaskId, taskData);
        showToast('Task updated', 'success');
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
    updateThemeIcon(next);
}

function loadTheme() {
    const theme = localStorage.getItem('taskflow_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
    document.getElementById('theme-icon-sun').style.display = theme === 'dark' ? 'block' : 'none';
    document.getElementById('theme-icon-moon').style.display = theme === 'light' ? 'block' : 'none';
}

// ─── Toast ───
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-exit'); setTimeout(() => toast.remove(), 200); }, 3000);
}

// ─── Utilities ───
function debounce(func, wait) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => func(...args), wait); }; }
function formatDate(dateStr) {
    const d = new Date(dateStr), now = new Date(), diff = Math.ceil((d - now) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff < -1) return `${Math.abs(diff)}d overdue`;
    if (diff <= 7) return `In ${diff}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
