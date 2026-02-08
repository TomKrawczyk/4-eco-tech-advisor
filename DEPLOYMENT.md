# 🚀 Instrukcja wdrożenia 4-ECO Tech Advisor na własnym serwerze

## 📋 Wymagania serwera

### Minimalne wymagania:
- **PHP**: 7.4 lub nowszy (zalecane 8.0+)
- **MySQL/MariaDB**: 5.7+ / 10.2+
- **Apache/Nginx**: z mod_rewrite (Apache) lub odpowiednią konfiguracją (Nginx)
- **Composer**: do instalacji zależności PHP
- **Node.js**: 16+ (do budowania frontendu)
- **SSL**: Certyfikat HTTPS (Let's Encrypt - darmowy)

### Zalecane:
- **RAM**: min. 1GB
- **Dysk**: min. 10GB
- **PHP Extensions**: mysqli, pdo_mysql, gd, zip, mbstring, curl, json

---

## 📦 Krok 1: Przygotowanie serwera

### A) Instalacja na Ubuntu/Debian:

```bash
# Aktualizacja systemu
sudo apt update && sudo apt upgrade -y

# Instalacja Apache, PHP, MySQL
sudo apt install apache2 php php-mysql php-gd php-zip php-mbstring php-curl mysql-server composer -y

# Włącz mod_rewrite
sudo a2enmod rewrite
sudo a2enmod headers
sudo systemctl restart apache2

# Instalacja Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y
```

### B) Instalacja na shared hostingu (home.pl, nazwa.pl):

1. Zaloguj się do panelu administracyjnego
2. Utwórz bazę danych MySQL
3. Zanotuj dane dostępowe (host, nazwa bazy, user, hasło)
4. Upewnij się, że masz dostęp do SSH lub File Managera

---

## 📂 Krok 2: Upload plików na serwer

### Opcja A: Przez Git (zalecane):

```bash
# Sklonuj repozytorium
cd /var/www/html
sudo git clone https://github.com/TomKrawczyk/4-eco-tech-advisor.git
cd 4-eco-tech-advisor

# Ustaw uprawnienia
sudo chown -R www-data:www-data .
sudo chmod -R 755 .
```

### Opcja B: Przez FTP/SFTP:

1. Zbuduj projekt lokalnie:
```bash
npm install
npm run build
```

2. Upload plików przez FTP:
   - Folder `dist/` → `/public_html/` (lub `/var/www/html/`)
   - Folder `backend/` → `/public_html/backend/`
   - Plik `.htaccess` → `/public_html/.htaccess`

---

## 🔧 Krok 3: Konfiguracja backendu

### 1. Instalacja zależności PHP:

```bash
cd backend
composer install
```

### 2. Konfiguracja bazy danych:

```bash
# Zaloguj się do MySQL
mysql -u root -p

# Utwórz bazę danych
CREATE DATABASE 4eco_tech_advisor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Utwórz użytkownika
CREATE USER '4eco_user'@'localhost' IDENTIFIED BY 'bezpieczne_haslo';
GRANT ALL PRIVILEGES ON 4eco_tech_advisor.* TO '4eco_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Importuj strukturę bazy
mysql -u 4eco_user -p 4eco_tech_advisor < backend/database.sql
```

### 3. Edytuj `backend/config.php`:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', '4eco_tech_advisor');
define('DB_USER', '4eco_user');
define('DB_PASS', 'twoje_haslo');

// Zmień API_KEY na losowy klucz
define('API_KEY', 'wygeneruj_losowy_klucz_64_znaki');

// Skonfiguruj SMTP
define('SMTP_USER', 'twoj_email@gmail.com');
define('SMTP_PASS', 'haslo_aplikacji_gmail');
```

### 4. Utwórz katalogi uploadów:

```bash
mkdir -p backend/uploads/photos
mkdir -p backend/uploads/exports
mkdir -p backend/uploads/pdfs
chmod 755 backend/uploads
chmod 755 backend/uploads/photos
chmod 755 backend/uploads/exports
chmod 755 backend/uploads/pdfs
```

### 5. Upload Google Service Account:

```bash
# Skopiuj plik google-credentials.json do backend/
cp /path/to/google-credentials.json backend/
chmod 600 backend/google-credentials.json
```

---

## 🌐 Krok 4: Konfiguracja Apache

### Edytuj `/etc/apache2/sites-available/000-default.conf`:

```apache
<VirtualHost *:80>
    ServerName twoja-domena.pl
    ServerAlias www.twoja-domena.pl
    DocumentRoot /var/www/html/4-eco-tech-advisor/dist

    <Directory /var/www/html/4-eco-tech-advisor/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/4eco_error.log
    CustomLog ${APACHE_LOG_DIR}/4eco_access.log combined
</VirtualHost>
```

### Restart Apache:

```bash
sudo systemctl restart apache2
```

---

## 🔒 Krok 5: Konfiguracja SSL (HTTPS)

### Instalacja Let's Encrypt (darmowy SSL):

```bash
# Instalacja Certbot
sudo apt install certbot python3-certbot-apache -y

# Wygeneruj certyfikat
sudo certbot --apache -d twoja-domena.pl -d www.twoja-domena.pl

# Automatyczne odnowienie (cron)
sudo certbot renew --dry-run
```

---

## 🎨 Krok 6: Build frontendu

### Jeśli budujesz na serwerze:

```bash
cd /var/www/html/4-eco-tech-advisor
npm install
npm run build

# Skopiuj zbudowane pliki
sudo cp -r dist/* /var/www/html/4-eco-tech-advisor/
```

### Jeśli budujesz lokalnie:

```bash
# Lokalnie
npm run build

# Upload folder dist/ przez FTP do /public_html/
```

---

## ⚙️ Krok 7: Konfiguracja Cron (opcjonalnie)

### Automatyczny dzienny digest:

```bash
# Edytuj crontab
crontab -e

# Dodaj linię (wysyłka o 8:00 rano)
0 8 * * * curl -X POST -H "X-API-Key: TWOJ_API_KEY" https://twoja-domena.pl/api/send-daily-digest
```

---

## 🧪 Krok 8: Testowanie

### 1. Sprawdź dostępność:
```
https://twoja-domena.pl
```

### 2. Test API:
```bash
curl -X GET -H "X-API-Key: TWOJ_API_KEY" https://twoja-domena.pl/api/sales-groups
```

### 3. Sprawdź logi błędów:
```bash
tail -f /var/log/apache2/4eco_error.log
tail -f backend/logs/error.log
```

---

## 🔧 Troubleshooting

### Problem: 500 Internal Server Error
**Rozwiązanie:**
```bash
# Sprawdź logi Apache
sudo tail -f /var/log/apache2/error.log

# Sprawdź uprawnienia
sudo chown -R www-data:www-data /var/www/html/4-eco-tech-advisor
sudo chmod -R 755 /var/www/html/4-eco-tech-advisor
```

### Problem: API nie działa (404)
**Rozwiązanie:**
```bash
# Sprawdź czy mod_rewrite jest włączony
sudo a2enmod rewrite
sudo systemctl restart apache2

# Sprawdź .htaccess
cat /var/www/html/4-eco-tech-advisor/.htaccess
```

### Problem: Upload zdjęć nie działa
**Rozwiązanie:**
```bash
# Zwiększ limity PHP
sudo nano /etc/php/8.0/apache2/php.ini

# Zmień:
upload_max_filesize = 10M
post_max_size = 10M
max_execution_time = 300

# Restart Apache
sudo systemctl restart apache2
```

### Problem: Email nie wysyła się
**Rozwiązanie:**
1. Sprawdź ustawienia SMTP w `backend/config.php`
2. Dla Gmail: włącz "Hasła aplikacji" w ustawieniach konta
3. Sprawdź logi: `tail -f backend/logs/email.log`

---

## 📊 Struktura katalogów na serwerze

```
/var/www/html/4-eco-tech-advisor/
├── dist/                      # Frontend (zbudowany React)
│   ├── index.html
│   ├── assets/
│   └── ...
├── backend/                   # Backend PHP
│   ├── api.php
│   ├── config.php
│   ├── database.php
│   ├── auth.php
│   ├── notifications.php
│   ├── export.php
│   ├── calendar.php
│   ├── upload.php
│   ├── google-credentials.json
│   └── uploads/
│       ├── photos/
│       ├── exports/
│       └── pdfs/
├── .htaccess                  # Apache config
└── .env.production            # Environment variables
```

---

## 🎯 Checklist wdrożenia

- [ ] Serwer skonfigurowany (PHP, MySQL, Apache)
- [ ] Baza danych utworzona i zaimportowana
- [ ] Composer dependencies zainstalowane
- [ ] `backend/config.php` skonfigurowany
- [ ] Google Service Account upload
- [ ] Katalogi uploadów utworzone (755)
- [ ] SSL certyfikat zainstalowany
- [ ] Frontend zbudowany i upload
- [ ] `.htaccess` skonfigurowany
- [ ] Apache mod_rewrite włączony
- [ ] Testy API działają
- [ ] Upload zdjęć działa
- [ ] Email notifications działają
- [ ] Cron job ustawiony (opcjonalnie)

---

## 📞 Wsparcie

W razie problemów:
1. Sprawdź logi: `/var/log/apache2/error.log`
2. Sprawdź uprawnienia plików
3. Sprawdź konfigurację PHP (`php -i | grep upload`)
4. Sprawdź połączenie z bazą danych

**Gotowe! Aplikacja powinna działać na https://twoja-domena.pl** 🎉