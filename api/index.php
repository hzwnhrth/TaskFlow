<?php

/**
 * TaskFlow API Router
 * 
 * Handles incoming HTTP requests and routes them to the appropriate
 * controller method. Supports CORS for frontend consumption.
 */

// CORS headers for frontend access
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/TaskController.php';

$controller = new TaskController();
$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

try {
    $response = match (true) {
        // List all tasks
        $action === 'list' && $method === 'GET'
            => $controller->list(),

        // Get statistics
        $action === 'stats' && $method === 'GET'
            => $controller->stats(),

        // Create a task
        $action === 'create' && $method === 'POST'
            => $controller->create(json_decode(file_get_contents('php://input'), true) ?? []),

        // Update a task
        $action === 'update' && $method === 'PUT'
            => $controller->update(
                $_GET['id'] ?? '',
                json_decode(file_get_contents('php://input'), true) ?? []
            ),

        // Delete a task
        $action === 'delete' && $method === 'DELETE'
            => $controller->delete($_GET['id'] ?? ''),

        // Unknown action
        default => ['success' => false, 'error' => 'Invalid action or method']
    };

    $statusCode = $response['success'] ? 200 : 400;
    http_response_code($statusCode);
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
