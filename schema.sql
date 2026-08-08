-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'staff',
    name VARCHAR(100) NOT NULL
);

-- Default admin credential insertion (username: admin / password: 123)
INSERT INTO users (username, password, role, name)
VALUES ('admin', '123', 'admin', 'مدير النظام')
ON CONFLICT (username) DO NOTHING;

-- 2. Games table
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    duration INT NOT NULL,
    price NUMERIC(10, 2) NOT NULL
);

-- Seed default games
INSERT INTO games (name, duration, price)
SELECT 'ترامبولين', 30, 50.00 
WHERE NOT EXISTS (SELECT 1 FROM games WHERE name = 'ترامبولين' AND duration = 30);

INSERT INTO games (name, duration, price)
SELECT 'ترامبولين', 60, 90.00 
WHERE NOT EXISTS (SELECT 1 FROM games WHERE name = 'ترامبولين' AND duration = 60);

INSERT INTO games (name, duration, price)
SELECT 'بلايستيشن', 30, 40.00 
WHERE NOT EXISTS (SELECT 1 FROM games WHERE name = 'بلايستيشن' AND duration = 30);

INSERT INTO games (name, duration, price)
SELECT 'بلايستيشن', 60, 70.00 
WHERE NOT EXISTS (SELECT 1 FROM games WHERE name = 'بلايستيشن' AND duration = 60);

-- 3. Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    shift_id VARCHAR(50) DEFAULT 'SHIFT-1',
    child_name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    game_name VARCHAR(100) NOT NULL,
    duration INT NOT NULL,
    player_count INT DEFAULT 1,
    unit_price NUMERIC(10, 2) DEFAULT 0,
    subtotal NUMERIC(10, 2) DEFAULT 0,
    discount NUMERIC(10, 2) DEFAULT 0,
    total_price NUMERIC(10, 2) NOT NULL,
    start_time VARCHAR(20),
    end_time VARCHAR(20),
    iso_date DATE DEFAULT CURRENT_DATE,
    created_by VARCHAR(50) DEFAULT 'admin',
    modified_by VARCHAR(50),
    deleted_by VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    shift_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all columns exist on older DB versions
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS shift_id VARCHAR(50) DEFAULT 'SHIFT-1';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS player_count INT DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_time VARCHAR(20);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_time VARCHAR(20);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS iso_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by VARCHAR(50) DEFAULT 'admin';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS modified_by VARCHAR(50);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(50);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS shift_closed BOOLEAN DEFAULT FALSE;