<?php

/**
 * TaskController - Handles all task CRUD operations
 * 
 * Manages tasks stored in a JSON file with full CRUD support,
 * including filtering, sorting, and search capabilities.
 */
class TaskController
{
    private string $dataFile;

    public function __construct()
    {
        $this->dataFile = __DIR__ . '/data/tasks.json';
        $this->ensureDataFile();
    }

    /**
     * Ensure the data file and directory exist
     */
    private function ensureDataFile(): void
    {
        $dir = dirname($this->dataFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        if (!file_exists($this->dataFile)) {
            file_put_contents($this->dataFile, json_encode([], JSON_PRETTY_PRINT));
        }
    }

    /**
     * Read all tasks from JSON storage
     */
    private function readTasks(): array
    {
        $content = file_get_contents($this->dataFile);
        return json_decode($content, true) ?? [];
    }

    /**
     * Write tasks to JSON storage
     */
    private function writeTasks(array $tasks): void
    {
        file_put_contents($this->dataFile, json_encode(array_values($tasks), JSON_PRETTY_PRINT));
    }

    /**
     * Generate a unique ID for a new task
     */
    private function generateId(): string
    {
        return 'task_' . bin2hex(random_bytes(8));
    }

    /**
     * GET - List all tasks with optional filtering
     */
    public function list(): array
    {
        $tasks = $this->readTasks();

        // Filter by category
        if (isset($_GET['category']) && $_GET['category'] !== 'all') {
            $category = $_GET['category'];
            $tasks = array_filter($tasks, fn($t) => $t['category'] === $category);
        }

        // Filter by priority
        if (isset($_GET['priority'])) {
            $priority = $_GET['priority'];
            $tasks = array_filter($tasks, fn($t) => $t['priority'] === $priority);
        }

        // Filter by status
        if (isset($_GET['status'])) {
            $status = $_GET['status'];
            if ($status === 'completed') {
                $tasks = array_filter($tasks, fn($t) => $t['completed'] === true);
            } elseif ($status === 'pending') {
                $tasks = array_filter($tasks, fn($t) => $t['completed'] === false);
            }
        }

        // Search by title or description
        if (isset($_GET['search']) && !empty($_GET['search'])) {
            $search = strtolower($_GET['search']);
            $tasks = array_filter($tasks, function ($t) use ($search) {
                return str_contains(strtolower($t['title']), $search)
                    || str_contains(strtolower($t['description'] ?? ''), $search);
            });
        }

        // Sort tasks
        $sortBy = $_GET['sort'] ?? 'created_at';
        $sortOrder = $_GET['order'] ?? 'desc';
        usort($tasks, function ($a, $b) use ($sortBy, $sortOrder) {
            $comparison = match ($sortBy) {
                'priority' => $this->priorityWeight($a['priority']) <=> $this->priorityWeight($b['priority']),
                'due_date' => strtotime($a['due_date'] ?? '9999-12-31') <=> strtotime($b['due_date'] ?? '9999-12-31'),
                'title' => strcasecmp($a['title'], $b['title']),
                default => strtotime($a['created_at']) <=> strtotime($b['created_at']),
            };
            return $sortOrder === 'desc' ? -$comparison : $comparison;
        });

        return [
            'success' => true,
            'data' => array_values($tasks),
            'count' => count($tasks)
        ];
    }

    /**
     * POST - Create a new task
     */
    public function create(array $data): array
    {
        // Validate required fields
        if (empty($data['title'])) {
            return ['success' => false, 'error' => 'Title is required'];
        }

        $tasks = $this->readTasks();

        $newTask = [
            'id' => $this->generateId(),
            'title' => htmlspecialchars(trim($data['title']), ENT_QUOTES, 'UTF-8'),
            'description' => htmlspecialchars(trim($data['description'] ?? ''), ENT_QUOTES, 'UTF-8'),
            'priority' => in_array($data['priority'] ?? '', ['low', 'medium', 'high', 'critical'])
                ? $data['priority'] : 'medium',
            'category' => htmlspecialchars(trim($data['category'] ?? 'general'), ENT_QUOTES, 'UTF-8'),
            'due_date' => $data['due_date'] ?? null,
            'completed' => false,
            'order' => count($tasks),
            'created_at' => date('c'),
            'updated_at' => date('c'),
        ];

        $tasks[] = $newTask;
        $this->writeTasks($tasks);

        return ['success' => true, 'data' => $newTask, 'message' => 'Task created successfully'];
    }

    /**
     * PUT - Update an existing task
     */
    public function update(string $id, array $data): array
    {
        $tasks = $this->readTasks();
        $index = $this->findTaskIndex($tasks, $id);

        if ($index === -1) {
            return ['success' => false, 'error' => 'Task not found'];
        }

        // Update allowed fields
        $allowedFields = ['title', 'description', 'priority', 'category', 'due_date', 'completed', 'order'];
        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                if (in_array($field, ['title', 'description', 'category'])) {
                    $tasks[$index][$field] = htmlspecialchars(trim($data[$field]), ENT_QUOTES, 'UTF-8');
                } else {
                    $tasks[$index][$field] = $data[$field];
                }
            }
        }

        $tasks[$index]['updated_at'] = date('c');
        $this->writeTasks($tasks);

        return ['success' => true, 'data' => $tasks[$index], 'message' => 'Task updated successfully'];
    }

    /**
     * DELETE - Remove a task
     */
    public function delete(string $id): array
    {
        $tasks = $this->readTasks();
        $index = $this->findTaskIndex($tasks, $id);

        if ($index === -1) {
            return ['success' => false, 'error' => 'Task not found'];
        }

        $deleted = $tasks[$index];
        array_splice($tasks, $index, 1);
        $this->writeTasks($tasks);

        return ['success' => true, 'data' => $deleted, 'message' => 'Task deleted successfully'];
    }

    /**
     * Get task statistics
     */
    public function stats(): array
    {
        $tasks = $this->readTasks();
        $total = count($tasks);
        $completed = count(array_filter($tasks, fn($t) => $t['completed']));
        $overdue = count(array_filter($tasks, function ($t) {
            return !$t['completed'] && $t['due_date'] && strtotime($t['due_date']) < time();
        }));

        $byPriority = [];
        foreach (['low', 'medium', 'high', 'critical'] as $p) {
            $byPriority[$p] = count(array_filter($tasks, fn($t) => $t['priority'] === $p));
        }

        return [
            'success' => true,
            'data' => [
                'total' => $total,
                'completed' => $completed,
                'pending' => $total - $completed,
                'overdue' => $overdue,
                'completion_rate' => $total > 0 ? round(($completed / $total) * 100, 1) : 0,
                'by_priority' => $byPriority,
            ]
        ];
    }

    /**
     * Find task index by ID
     */
    private function findTaskIndex(array $tasks, string $id): int
    {
        foreach ($tasks as $index => $task) {
            if ($task['id'] === $id) {
                return $index;
            }
        }
        return -1;
    }

    /**
     * Get numeric weight for priority sorting
     */
    private function priorityWeight(string $priority): int
    {
        return match ($priority) {
            'critical' => 4,
            'high' => 3,
            'medium' => 2,
            'low' => 1,
            default => 0,
        };
    }
}
