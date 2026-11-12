<?php
declare(strict_types=1);

final class Router
{
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler, bool $public = false): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
        $this->routes[] = [$method, $regex, $handler, $public];
    }

    public function get(string $p, callable $h, bool $public = false): void { $this->add('GET', $p, $h, $public); }
    public function post(string $p, callable $h, bool $public = false): void { $this->add('POST', $p, $h, $public); }
    public function put(string $p, callable $h, bool $public = false): void { $this->add('PUT', $p, $h, $public); }
    public function delete(string $p, callable $h, bool $public = false): void { $this->add('DELETE', $p, $h, $public); }

    public function dispatch(string $method, string $path): void
    {
        $allowed = [];
        foreach ($this->routes as [$m, $regex, $handler, $public]) {
            if (!preg_match($regex, $path, $matches)) {
                continue;
            }
            if ($m !== $method) {
                $allowed[] = $m;
                continue;
            }
            if (!$public) {
                require_user();
            }
            $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
            $result = $handler($params);
            if ($result !== null) {
                json_response($result);
            }
            return;
        }
        if ($allowed) {
            throw new HttpError(405, 'Method not allowed.');
        }
        throw new HttpError(404, 'Endpoint not found.');
    }
}

function id_param(array $params, string $key = 'id'): int
{
    $v = $params[$key] ?? '';
    if (!ctype_digit((string) $v)) {
        throw new HttpError(404, 'Not found.');
    }
    return (int) $v;
}
