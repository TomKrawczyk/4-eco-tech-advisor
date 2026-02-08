# Instrukcja instalacji - 4-ECO Tech Advisor

## Wymagania

### Serwer
- PHP 7.4 lub wyższy
- MySQL 5.7 lub wyższy
- Apache/Nginx z mod_rewrite
- SSL (HTTPS)

### Composer (dla PHP)
```bash
composer require google/apiclient
composer require dompdf/dompdf
```

## Krok 1: Konfiguracja bazy danych

1. Utwórz bazę danych MySQL:
```sql
CREATE DATABASE eco_tech_advisor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'eco_user'@'localhost' IDENTIFIED BY 'twoje_haslo';
GRANT ALL PRIVILEGES ON eco_tech_advisor.* TO 'eco_user'@'localhost';
FLUSH PRIVILEGES;
```

2. Edytuj `backend/config.php`:
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'eco_tech_advisor');
define('DB_USER', 'eco_user');
define('DB_PASS', 'twoje_haslo');
```

## Krok 2: Inicjalizacja tabel

Uruchom skrypt inicjalizacyjny:
```php
<?php
require_once 'backend/database.php';
$db = new Database();
$db->initTables();
echo "Tabele utworzone pomyślnie!";
?>
```

## Krok 3: Konfiguracja Google Sheets

1. Utwórz projekt w Google Cloud Console
2. Włącz Google Sheets API
3. Utwórz Service Account i pobierz plik JSON z kluczami
4. Zapisz plik jako `backend/google-credentials.json`
5. Udostępnij arkusz Google Sheets dla email Service Account
6. Skopiuj ID arkusza z URL i wklej do `backend/config.php`:
```php
define('GOOGLE_SHEETS_ID', 'twoj_arkusz_id');
```

## Krok 4: Konfiguracja WordPress

1. Zainstaluj plugin "Application Passwords" w WordPressie
2. Wygeneruj hasło aplikacji dla użytkownika
3. Edytuj `backend/config.php`:
```php
define('WP_API_URL', 'https://twoja-domena.pl/wp-json/wp/v2');
define('WP_USERNAME', 'twoj_wp_user');
define('WP_PASSWORD', 'haslo_aplikacji');
```

## Krok 5: Konfiguracja API Key

Wygeneruj bezpieczny klucz API:
```bash
php -r "echo bin2hex(random_bytes(32));"
```

Wklej do `backend/config.php`:
```php
define('API_KEY', 'wygenerowany_klucz');
```

## Krok 6: Konfiguracja CORS

Edytuj `backend/config.php` i dodaj dozwolone domeny:
```php
define('ALLOWED_ORIGINS', [
    'http://localhost:5173',
    'https://twoja-domena.pl'
]);
```

## Krok 7: Konfiguracja Frontend

1. Utwórz plik `.env` w głównym katalogu:
```env
VITE_API_URL=https://twoja-domena.pl/backend/api.php
VITE_API_KEY=twoj_api_key
```

2. Zainstaluj zależności:
```bash
npm install
```

3. Zbuduj aplikację:
```bash
npm run build
```

## Krok 8: Konfiguracja Apache/Nginx

### Apache (.htaccess w katalogu backend):
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ api.php [QSA,L]

<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type, Authorization, X-API-Key"
</IfModule>
```

### Nginx:
```nginx
location /backend/ {
    try_files $uri $uri/ /backend/api.php?$query_string;
    
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-API-Key";
}
```

## Krok 9: Uprawnienia katalogów

```bash
chmod 755 backend/
chmod 755 backend/uploads/
chmod 755 backend/uploads/pdfs/
chmod 600 backend/config.php
chmod 600 backend/google-credentials.json
```

## Krok 10: Testowanie

1. Otwórz aplikację w przeglądarce
2. Zaloguj się jako administrator:
   - Email: `admin@4eco.pl`
   - Hasło: `admin123`
3. **ZMIEŃ HASŁO ADMINISTRATORA NATYCHMIAST!**

## Funkcje systemu

### System akceptacji użytkowników
- Nowi użytkownicy mają status "pending"
- Administrator musi zaakceptować konto
- Użytkownicy z statusem "pending" nie mogą się zalogować

### Widoczność raportów
- Zwykły użytkownik widzi tylko swoje raporty
- Administrator widzi wszystkie raporty

### Grupy handlowców
- Administrator może tworzyć grupy
- Przypisywanie użytkowników do grup
- Raporty są tagowane grupą użytkownika

### Automatyzacja
- Automatyczny zapis do Google Sheets
- Automatyczne generowanie PDF
- Automatyczny post w WordPressie
- Wszystko przy jednym kliknięciu "Zapisz raport"

## Rozwiązywanie problemów

### Błąd połączenia z bazą danych
- Sprawdź dane w `config.php`
- Sprawdź czy MySQL działa: `systemctl status mysql`

### Błąd Google Sheets API
- Sprawdź czy plik `google-credentials.json` istnieje
- Sprawdź czy arkusz jest udostępniony dla Service Account
- Sprawdź logi: `tail -f /var/log/apache2/error.log`

### Błąd CORS
- Sprawdź konfigurację CORS w `config.php`
- Sprawdź konfigurację serwera (Apache/Nginx)

## Bezpieczeństwo

1. **Zawsze używaj HTTPS**
2. **Zmień domyślne hasło administratora**
3. **Regularnie aktualizuj zależności**
4. **Backupuj bazę danych codziennie**
5. **Ogranicz dostęp do plików konfiguracyjnych**

## Wsparcie

W razie problemów:
1. Sprawdź logi serwera
2. Sprawdź logi PHP
3. Sprawdź konsolę przeglądarki (F12)