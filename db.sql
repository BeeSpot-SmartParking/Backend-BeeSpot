-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create custom ENUM types
CREATE TYPE user_language AS ENUM('ar', 'fr', 'en');
CREATE TYPE parking_type AS ENUM('public', 'organized');
CREATE TYPE reservation_status AS ENUM('pending', 'confirmed', 'active', 'completed', 'cancelled', 'no_show');
CREATE TYPE payment_method AS ENUM('cash', 'cib_card', 'edahabia', 'mobile_money');
CREATE TYPE payment_status AS ENUM('pending', 'paid', 'failed', 'refunded');
CREATE TYPE violation_type AS ENUM('unauthorized_parking', 'overtime', 'double_parking', 'blocking_exit');
CREATE TYPE violation_status AS ENUM('issued', 'paid', 'contested', 'cancelled');
CREATE TYPE subscription_status AS ENUM('basic', 'pro');
CREATE TYPE spot_type AS ENUM('standard', 'compact', 'handicapped', 'electric');

-- Users table  
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20), -- Algerian format: +213-XXX-XXX-XXX
    matricule VARCHAR(20), -- Algerian plate format
    wilaya_code INTEGER CHECK (wilaya_code BETWEEN 1 AND 58),
    preferred_language user_language DEFAULT 'fr',
    id_card_number VARCHAR(18), -- Algerian national ID
    is_company BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Companies table
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    wilaya VARCHAR(50),
    commune VARCHAR(100),
    subscription_status subscription_status DEFAULT 'basic',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parking locations
CREATE TABLE parking_locations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255),
    name_fr VARCHAR(255),
    address TEXT NOT NULL,
    address_ar TEXT,
    wilaya VARCHAR(50) NOT NULL,
    commune VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    coordinates GEOMETRY(POINT, 4326), -- PostGIS point type
    parking_type parking_type NOT NULL,
    total_spots INTEGER NOT NULL CHECK (total_spots > 0),
    available_spots INTEGER NOT NULL,
    price_per_hour DECIMAL(10, 2) NOT NULL CHECK (price_per_hour >= 0),
    accepts_cash BOOLEAN DEFAULT TRUE,
    accepts_card BOOLEAN DEFAULT FALSE,
    has_security BOOLEAN DEFAULT FALSE,
    has_shelter BOOLEAN DEFAULT FALSE,
    operates_24h BOOLEAN DEFAULT FALSE,
    opening_time TIME,
    closing_time TIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_coordinates_match CHECK (
        ST_X(coordinates::geometry) = longitude AND 
        ST_Y(coordinates::geometry) = latitude
    )
);

-- Trigger to automatically set coordinates from lat/long
CREATE OR REPLACE FUNCTION update_parking_coordinates()
RETURNS TRIGGER AS $$
BEGIN
    NEW.coordinates = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coordinates_trigger
BEFORE INSERT OR UPDATE OF latitude, longitude ON parking_locations
FOR EACH ROW EXECUTE FUNCTION update_parking_coordinates();

-- Individual parking spots
CREATE TABLE parking_spots (
    id SERIAL PRIMARY KEY,
    parking_location_id INTEGER REFERENCES parking_locations(id) ON DELETE CASCADE,
    spot_number VARCHAR(10) NOT NULL,
    spot_type spot_type DEFAULT 'standard',
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parking_location_id, spot_number)
);

-- Reservations table
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    parking_location_id INTEGER REFERENCES parking_locations(id),
    parking_spot_id INTEGER REFERENCES parking_spots(id) ON DELETE SET NULL,
    reservation_start TIMESTAMP NOT NULL,
    reservation_end TIMESTAMP NOT NULL,
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,
    status reservation_status DEFAULT 'pending',
    base_amount_dzd DECIMAL(10, 2) NOT NULL CHECK (base_amount_dzd >= 0),
    extra_charges_dzd DECIMAL(10, 2) DEFAULT 0 CHECK (extra_charges_dzd >= 0),
    total_amount_dzd DECIMAL(10, 2) NOT NULL CHECK (total_amount_dzd >= 0),
    payment_method payment_method DEFAULT 'cash',
    payment_status payment_status DEFAULT 'pending',
    qr_code VARCHAR(255),
    confirmation_code VARCHAR(8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_reservation_period CHECK (reservation_end > reservation_start),
    CONSTRAINT valid_actual_period CHECK (actual_end IS NULL OR actual_start IS NULL OR actual_end > actual_start)
);

-- Time-based pricing rules
CREATE TABLE pricing_rules (
    id SERIAL PRIMARY KEY,
    parking_location_id INTEGER REFERENCES parking_locations(id) ON DELETE CASCADE,
    rule_name VARCHAR(100) NOT NULL,
    start_time TIME,
    end_time TIME,
    days_of_week INTEGER[],
    price_multiplier DECIMAL(3, 2) DEFAULT 1.00 CHECK (price_multiplier > 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Traffic violations and reports
CREATE TABLE traffic_violations (
    id SERIAL PRIMARY KEY,
    parking_location_id INTEGER REFERENCES parking_locations(id),
    matricule VARCHAR(20) NOT NULL,
    violation_type violation_type NOT NULL,
    fine_amount_dzd DECIMAL(10, 2) CHECK (fine_amount_dzd >= 0),
    officer_badge VARCHAR(20),
    violation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status violation_status DEFAULT 'issued',
    image_evidence_url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Special events affecting parking
CREATE TABLE special_events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(255) NOT NULL,
    event_name_ar VARCHAR(255),
    event_date DATE NOT NULL,
    affects_parking BOOLEAN DEFAULT TRUE,
    price_multiplier DECIMAL(3, 2) DEFAULT 1.0 CHECK (price_multiplier > 0),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Special event areas (separate table for geometry)
CREATE TABLE special_event_areas (
    id SERIAL PRIMARY KEY,
    special_event_id INTEGER REFERENCES special_events(id) ON DELETE CASCADE,
    area_name VARCHAR(100),
    restricted_area GEOMETRY(POLYGON, 4326) NOT NULL
);

-- Create proper indexes for performance
CREATE INDEX idx_parking_locations_wilaya ON parking_locations(wilaya);
CREATE INDEX idx_parking_locations_spatial ON parking_locations USING GIST(coordinates);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_dates ON reservations(reservation_start, reservation_end);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_parking_spots_location_id ON parking_spots(parking_location_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_matricule ON users(matricule);
CREATE INDEX idx_violations_matricule ON traffic_violations(matricule);

-- Function to find nearby parking (optimized for Algeria)
CREATE OR REPLACE FUNCTION find_nearby_parking(
    user_lat DECIMAL,
    user_lng DECIMAL,
    search_radius_km INTEGER DEFAULT 5,
    max_price_dzd DECIMAL DEFAULT NULL,
    preferred_wilaya VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id INTEGER,
    name VARCHAR,
    distance_km DECIMAL,
    available_spots INTEGER,
    price_per_hour DECIMAL,
    coordinates_lat DECIMAL,
    coordinates_lng DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pl.id,
        pl.name,
        ROUND(
            ST_Distance(
                ST_Point(user_lng, user_lat)::geography,
                pl.coordinates::geography
            ) / 1000, 2
        ) as distance_km,
        pl.available_spots,
        pl.price_per_hour,
        ST_Y(pl.coordinates) as coordinates_lat,
        ST_X(pl.coordinates) as coordinates_lng
    FROM parking_locations pl
    WHERE pl.is_active = TRUE
    AND ST_DWithin(
        pl.coordinates::geography,
        ST_Point(user_lng, user_lat)::geography,
        search_radius_km * 1000
    )
    AND (max_price_dzd IS NULL OR pl.price_per_hour <= max_price_dzd)
    AND (preferred_wilaya IS NULL OR pl.wilaya = preferred_wilaya)
    ORDER BY distance_km
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;