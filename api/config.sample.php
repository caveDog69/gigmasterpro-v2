<?php
// Copy to config.php (the deploy workflow writes it from GitHub secrets automatically).
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'cpaneluser_gigmasterpro',
    'db_user' => 'cpaneluser_gmp',
    'db_pass' => 'change-me',
    // Public site URL, used in emails and calendar links (e.g. https://example.com or https://example.com/dev).
    'app_url' => 'https://example.com',
    'mail_from' => 'GigMasterPro <no-reply@example.com>',
    // Allowed browser origin for cross-origin API calls (only needed when the frontend is hosted elsewhere).
    'cors_origin' => '',
    'debug' => false,
];
