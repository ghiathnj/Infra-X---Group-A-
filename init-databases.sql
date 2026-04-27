-- Create databases for each service if they don't exist.
-- Mounted into the MariaDB container via docker-compose.
CREATE DATABASE IF NOT EXISTS auth_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS clinicdb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Grant privileges to root user for both databases.
GRANT ALL PRIVILEGES ON auth_db.* TO 'root'@'%' IDENTIFIED BY 'root';
GRANT ALL PRIVILEGES ON clinicdb.* TO 'root'@'%' IDENTIFIED BY 'root';
FLUSH PRIVILEGES;
