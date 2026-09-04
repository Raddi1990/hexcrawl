<?php
require_once __DIR__ . '/api/_auth.php';

$config = load_config();
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    $adminUsername = $config['admin_username'] ?? '';
    $adminPassword = $config['admin_password'] ?? '';
    if ($adminUsername !== '' && $adminPassword !== ''
        && hash_equals($adminUsername, $username) && hash_equals($adminPassword, $password)) {
        $_SESSION['is_admin'] = true;
        header('Location: admin/index.php');
        exit;
    }
    $error = 'Benutzername oder Passwort falsch.';
}
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hexcrawl – Admin-Login</title>
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="auth-page">
<main class="auth-box">
  <h1>Admin-Login</h1>
  <?php if ($error): ?><p class="message error"><?= htmlspecialchars($error) ?></p><?php endif; ?>
  <form method="post">
    <label>Benutzername<br><input type="text" name="username" required autofocus></label>
    <label>Passwort<br><input type="password" name="password" required></label>
    <button type="submit">Anmelden</button>
  </form>
  <p><a href="index.php">Zurück zur Karte</a></p>
</main>
</body>
</html>
