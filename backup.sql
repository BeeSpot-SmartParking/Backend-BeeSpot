--
-- PostgreSQL database dump
--

-- Dumped from database version 15.4
-- Dumped by pg_dump version 15.4

-- Started on 2025-09-19 15:23:19

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 40961)
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- TOC entry 4440 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- TOC entry 1654 (class 1247 OID 42056)
-- Name: parking_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.parking_type AS ENUM (
    'public',
    'organized'
);


ALTER TYPE public.parking_type OWNER TO postgres;

--
-- TOC entry 1660 (class 1247 OID 42076)
-- Name: payment_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'cib_card',
    'edahabia',
    'mobile_money'
);


ALTER TYPE public.payment_method OWNER TO postgres;

--
-- TOC entry 1663 (class 1247 OID 42086)
-- Name: payment_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded'
);


ALTER TYPE public.payment_status OWNER TO postgres;

--
-- TOC entry 1657 (class 1247 OID 42062)
-- Name: reservation_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.reservation_status AS ENUM (
    'pending',
    'confirmed',
    'active',
    'completed',
    'cancelled',
    'no_show'
);


ALTER TYPE public.reservation_status OWNER TO postgres;

--
-- TOC entry 1675 (class 1247 OID 42122)
-- Name: spot_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.spot_type AS ENUM (
    'standard',
    'compact',
    'handicapped',
    'electric'
);


ALTER TYPE public.spot_type OWNER TO postgres;

--
-- TOC entry 1672 (class 1247 OID 42116)
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.subscription_status AS ENUM (
    'basic',
    'pro'
);


ALTER TYPE public.subscription_status OWNER TO postgres;

--
-- TOC entry 1651 (class 1247 OID 42049)
-- Name: user_language; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_language AS ENUM (
    'ar',
    'fr',
    'en'
);


ALTER TYPE public.user_language OWNER TO postgres;

--
-- TOC entry 1669 (class 1247 OID 42106)
-- Name: violation_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.violation_status AS ENUM (
    'issued',
    'paid',
    'contested',
    'cancelled'
);


ALTER TYPE public.violation_status OWNER TO postgres;

--
-- TOC entry 1666 (class 1247 OID 42096)
-- Name: violation_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.violation_type AS ENUM (
    'unauthorized_parking',
    'overtime',
    'double_parking',
    'blocking_exit'
);


ALTER TYPE public.violation_type OWNER TO postgres;

--
-- TOC entry 1003 (class 1255 OID 42319)
-- Name: find_nearby_parking(numeric, numeric, integer, numeric, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.find_nearby_parking(user_lat numeric, user_lng numeric, search_radius_km integer DEFAULT 5, max_price_dzd numeric DEFAULT NULL::numeric, preferred_wilaya character varying DEFAULT NULL::character varying) RETURNS TABLE(id integer, name character varying, distance_km numeric, available_spots integer, price_per_hour numeric, coordinates_lat numeric, coordinates_lng numeric)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.find_nearby_parking(user_lat numeric, user_lng numeric, search_radius_km integer, max_price_dzd numeric, preferred_wilaya character varying) OWNER TO postgres;

--
-- TOC entry 1002 (class 1255 OID 42191)
-- Name: update_parking_coordinates(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_parking_coordinates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.coordinates = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_parking_coordinates() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 223 (class 1259 OID 42148)
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    user_id integer,
    company_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    address text,
    wilaya character varying(50),
    commune character varying(100),
    subscription_status public.subscription_status DEFAULT 'basic'::public.subscription_status,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 42147)
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.companies_id_seq OWNER TO postgres;

--
-- TOC entry 4441 (class 0 OID 0)
-- Dependencies: 222
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- TOC entry 225 (class 1259 OID 42167)
-- Name: parking_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parking_locations (
    id integer NOT NULL,
    company_id integer,
    name character varying(255) NOT NULL,
    name_ar character varying(255),
    name_fr character varying(255),
    address text NOT NULL,
    address_ar text,
    wilaya character varying(50) NOT NULL,
    commune character varying(100) NOT NULL,
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    coordinates public.geometry(Point,4326),
    parking_type public.parking_type NOT NULL,
    total_spots integer NOT NULL,
    available_spots integer NOT NULL,
    price_per_hour numeric(10,2) NOT NULL,
    accepts_cash boolean DEFAULT true,
    accepts_card boolean DEFAULT false,
    has_security boolean DEFAULT false,
    has_shelter boolean DEFAULT false,
    operates_24h boolean DEFAULT false,
    opening_time time without time zone,
    closing_time time without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_coordinates_match CHECK (((public.st_x((coordinates)::public.geometry) = (longitude)::double precision) AND (public.st_y((coordinates)::public.geometry) = (latitude)::double precision))),
    CONSTRAINT parking_locations_price_per_hour_check CHECK ((price_per_hour >= (0)::numeric)),
    CONSTRAINT parking_locations_total_spots_check CHECK ((total_spots > 0))
);


ALTER TABLE public.parking_locations OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 42166)
-- Name: parking_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.parking_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.parking_locations_id_seq OWNER TO postgres;

--
-- TOC entry 4442 (class 0 OID 0)
-- Dependencies: 224
-- Name: parking_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.parking_locations_id_seq OWNED BY public.parking_locations.id;


--
-- TOC entry 227 (class 1259 OID 42194)
-- Name: parking_spots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parking_spots (
    id integer NOT NULL,
    parking_location_id integer,
    spot_number character varying(10) NOT NULL,
    spot_type public.spot_type DEFAULT 'standard'::public.spot_type,
    is_available boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.parking_spots OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 42193)
-- Name: parking_spots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.parking_spots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.parking_spots_id_seq OWNER TO postgres;

--
-- TOC entry 4443 (class 0 OID 0)
-- Dependencies: 226
-- Name: parking_spots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.parking_spots_id_seq OWNED BY public.parking_spots.id;


--
-- TOC entry 231 (class 1259 OID 42245)
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pricing_rules (
    id integer NOT NULL,
    parking_location_id integer,
    rule_name character varying(100) NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    days_of_week integer[],
    price_multiplier numeric(3,2) DEFAULT 1.00,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pricing_rules_price_multiplier_check CHECK ((price_multiplier > (0)::numeric))
);


ALTER TABLE public.pricing_rules OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 42244)
-- Name: pricing_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pricing_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pricing_rules_id_seq OWNER TO postgres;

--
-- TOC entry 4444 (class 0 OID 0)
-- Dependencies: 230
-- Name: pricing_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pricing_rules_id_seq OWNED BY public.pricing_rules.id;


--
-- TOC entry 229 (class 1259 OID 42212)
-- Name: reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reservations (
    id integer NOT NULL,
    user_id integer,
    parking_location_id integer,
    parking_spot_id integer,
    reservation_start timestamp without time zone NOT NULL,
    reservation_end timestamp without time zone NOT NULL,
    actual_start timestamp without time zone,
    actual_end timestamp without time zone,
    status public.reservation_status DEFAULT 'pending'::public.reservation_status,
    base_amount_dzd numeric(10,2) NOT NULL,
    extra_charges_dzd numeric(10,2) DEFAULT 0,
    total_amount_dzd numeric(10,2) NOT NULL,
    payment_method public.payment_method DEFAULT 'cash'::public.payment_method,
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status,
    qr_code character varying(255),
    confirmation_code character varying(8),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reservations_base_amount_dzd_check CHECK ((base_amount_dzd >= (0)::numeric)),
    CONSTRAINT reservations_extra_charges_dzd_check CHECK ((extra_charges_dzd >= (0)::numeric)),
    CONSTRAINT reservations_total_amount_dzd_check CHECK ((total_amount_dzd >= (0)::numeric)),
    CONSTRAINT valid_actual_period CHECK (((actual_end IS NULL) OR (actual_start IS NULL) OR (actual_end > actual_start))),
    CONSTRAINT valid_reservation_period CHECK ((reservation_end > reservation_start))
);


ALTER TABLE public.reservations OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 42211)
-- Name: reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.reservations_id_seq OWNER TO postgres;

--
-- TOC entry 4445 (class 0 OID 0)
-- Dependencies: 228
-- Name: reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reservations_id_seq OWNED BY public.reservations.id;


--
-- TOC entry 237 (class 1259 OID 42297)
-- Name: special_event_areas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.special_event_areas (
    id integer NOT NULL,
    special_event_id integer,
    area_name character varying(100),
    restricted_area public.geometry(Polygon,4326) NOT NULL
);


ALTER TABLE public.special_event_areas OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 42296)
-- Name: special_event_areas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.special_event_areas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.special_event_areas_id_seq OWNER TO postgres;

--
-- TOC entry 4446 (class 0 OID 0)
-- Dependencies: 236
-- Name: special_event_areas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.special_event_areas_id_seq OWNED BY public.special_event_areas.id;


--
-- TOC entry 235 (class 1259 OID 42283)
-- Name: special_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.special_events (
    id integer NOT NULL,
    event_name character varying(255) NOT NULL,
    event_name_ar character varying(255),
    event_date date NOT NULL,
    affects_parking boolean DEFAULT true,
    price_multiplier numeric(3,2) DEFAULT 1.0,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT special_events_price_multiplier_check CHECK ((price_multiplier > (0)::numeric))
);


ALTER TABLE public.special_events OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 42282)
-- Name: special_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.special_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.special_events_id_seq OWNER TO postgres;

--
-- TOC entry 4447 (class 0 OID 0)
-- Dependencies: 234
-- Name: special_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.special_events_id_seq OWNED BY public.special_events.id;


--
-- TOC entry 233 (class 1259 OID 42264)
-- Name: traffic_violations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.traffic_violations (
    id integer NOT NULL,
    parking_location_id integer,
    matricule character varying(20) NOT NULL,
    violation_type public.violation_type NOT NULL,
    fine_amount_dzd numeric(10,2),
    officer_badge character varying(20),
    violation_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status public.violation_status DEFAULT 'issued'::public.violation_status,
    image_evidence_url character varying(500),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT traffic_violations_fine_amount_dzd_check CHECK ((fine_amount_dzd >= (0)::numeric))
);


ALTER TABLE public.traffic_violations OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 42263)
-- Name: traffic_violations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.traffic_violations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.traffic_violations_id_seq OWNER TO postgres;

--
-- TOC entry 4448 (class 0 OID 0)
-- Dependencies: 232
-- Name: traffic_violations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.traffic_violations_id_seq OWNED BY public.traffic_violations.id;


--
-- TOC entry 221 (class 1259 OID 42132)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255),
    phone character varying(20),
    matricule character varying(20),
    wilaya_code integer,
    preferred_language public.user_language DEFAULT 'fr'::public.user_language,
    id_card_number character varying(18),
    is_company boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_wilaya_code_check CHECK (((wilaya_code >= 1) AND (wilaya_code <= 58)))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 42131)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 4449 (class 0 OID 0)
-- Dependencies: 220
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4171 (class 2604 OID 42151)
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- TOC entry 4175 (class 2604 OID 42170)
-- Name: parking_locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_locations ALTER COLUMN id SET DEFAULT nextval('public.parking_locations_id_seq'::regclass);


--
-- TOC entry 4184 (class 2604 OID 42197)
-- Name: parking_spots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_spots ALTER COLUMN id SET DEFAULT nextval('public.parking_spots_id_seq'::regclass);


--
-- TOC entry 4196 (class 2604 OID 42248)
-- Name: pricing_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules ALTER COLUMN id SET DEFAULT nextval('public.pricing_rules_id_seq'::regclass);


--
-- TOC entry 4189 (class 2604 OID 42215)
-- Name: reservations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations ALTER COLUMN id SET DEFAULT nextval('public.reservations_id_seq'::regclass);


--
-- TOC entry 4211 (class 2604 OID 42300)
-- Name: special_event_areas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_event_areas ALTER COLUMN id SET DEFAULT nextval('public.special_event_areas_id_seq'::regclass);


--
-- TOC entry 4206 (class 2604 OID 42286)
-- Name: special_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_events ALTER COLUMN id SET DEFAULT nextval('public.special_events_id_seq'::regclass);


--
-- TOC entry 4201 (class 2604 OID 42267)
-- Name: traffic_violations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_violations ALTER COLUMN id SET DEFAULT nextval('public.traffic_violations_id_seq'::regclass);


--
-- TOC entry 4166 (class 2604 OID 42135)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4420 (class 0 OID 42148)
-- Dependencies: 223
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, user_id, company_name, email, phone, address, wilaya, commune, subscription_status, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4422 (class 0 OID 42167)
-- Dependencies: 225
-- Data for Name: parking_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.parking_locations (id, company_id, name, name_ar, name_fr, address, address_ar, wilaya, commune, latitude, longitude, coordinates, parking_type, total_spots, available_spots, price_per_hour, accepts_cash, accepts_card, has_security, has_shelter, operates_24h, opening_time, closing_time, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4424 (class 0 OID 42194)
-- Dependencies: 227
-- Data for Name: parking_spots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.parking_spots (id, parking_location_id, spot_number, spot_type, is_available, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4428 (class 0 OID 42245)
-- Dependencies: 231
-- Data for Name: pricing_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pricing_rules (id, parking_location_id, rule_name, start_time, end_time, days_of_week, price_multiplier, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4426 (class 0 OID 42212)
-- Dependencies: 229
-- Data for Name: reservations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reservations (id, user_id, parking_location_id, parking_spot_id, reservation_start, reservation_end, actual_start, actual_end, status, base_amount_dzd, extra_charges_dzd, total_amount_dzd, payment_method, payment_status, qr_code, confirmation_code, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4165 (class 0 OID 41283)
-- Dependencies: 216
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- TOC entry 4434 (class 0 OID 42297)
-- Dependencies: 237
-- Data for Name: special_event_areas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.special_event_areas (id, special_event_id, area_name, restricted_area) FROM stdin;
\.


--
-- TOC entry 4432 (class 0 OID 42283)
-- Dependencies: 235
-- Data for Name: special_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.special_events (id, event_name, event_name_ar, event_date, affects_parking, price_multiplier, description, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4430 (class 0 OID 42264)
-- Dependencies: 233
-- Data for Name: traffic_violations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.traffic_violations (id, parking_location_id, matricule, violation_type, fine_amount_dzd, officer_badge, violation_time, status, image_evidence_url, notes, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4418 (class 0 OID 42132)
-- Dependencies: 221
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, email, password_hash, full_name, phone, matricule, wilaya_code, preferred_language, id_card_number, is_company, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 4450 (class 0 OID 0)
-- Dependencies: 222
-- Name: companies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.companies_id_seq', 1, false);


--
-- TOC entry 4451 (class 0 OID 0)
-- Dependencies: 224
-- Name: parking_locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.parking_locations_id_seq', 1, false);


--
-- TOC entry 4452 (class 0 OID 0)
-- Dependencies: 226
-- Name: parking_spots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.parking_spots_id_seq', 1, false);


--
-- TOC entry 4453 (class 0 OID 0)
-- Dependencies: 230
-- Name: pricing_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pricing_rules_id_seq', 1, false);


--
-- TOC entry 4454 (class 0 OID 0)
-- Dependencies: 228
-- Name: reservations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reservations_id_seq', 1, false);


--
-- TOC entry 4455 (class 0 OID 0)
-- Dependencies: 236
-- Name: special_event_areas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.special_event_areas_id_seq', 1, false);


--
-- TOC entry 4456 (class 0 OID 0)
-- Dependencies: 234
-- Name: special_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.special_events_id_seq', 1, false);


--
-- TOC entry 4457 (class 0 OID 0)
-- Dependencies: 232
-- Name: traffic_violations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.traffic_violations_id_seq', 1, false);


--
-- TOC entry 4458 (class 0 OID 0)
-- Dependencies: 220
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- TOC entry 4234 (class 2606 OID 42160)
-- Name: companies companies_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_email_key UNIQUE (email);


--
-- TOC entry 4236 (class 2606 OID 42158)
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- TOC entry 4240 (class 2606 OID 42185)
-- Name: parking_locations parking_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_locations
    ADD CONSTRAINT parking_locations_pkey PRIMARY KEY (id);


--
-- TOC entry 4243 (class 2606 OID 42205)
-- Name: parking_spots parking_spots_parking_location_id_spot_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_spots
    ADD CONSTRAINT parking_spots_parking_location_id_spot_number_key UNIQUE (parking_location_id, spot_number);


--
-- TOC entry 4245 (class 2606 OID 42203)
-- Name: parking_spots parking_spots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_spots
    ADD CONSTRAINT parking_spots_pkey PRIMARY KEY (id);


--
-- TOC entry 4252 (class 2606 OID 42257)
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 4250 (class 2606 OID 42228)
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- TOC entry 4259 (class 2606 OID 42304)
-- Name: special_event_areas special_event_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_event_areas
    ADD CONSTRAINT special_event_areas_pkey PRIMARY KEY (id);


--
-- TOC entry 4257 (class 2606 OID 42295)
-- Name: special_events special_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_events
    ADD CONSTRAINT special_events_pkey PRIMARY KEY (id);


--
-- TOC entry 4255 (class 2606 OID 42276)
-- Name: traffic_violations traffic_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_violations
    ADD CONSTRAINT traffic_violations_pkey PRIMARY KEY (id);


--
-- TOC entry 4230 (class 2606 OID 42146)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4232 (class 2606 OID 42144)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4237 (class 1259 OID 42311)
-- Name: idx_parking_locations_spatial; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parking_locations_spatial ON public.parking_locations USING gist (coordinates);


--
-- TOC entry 4238 (class 1259 OID 42310)
-- Name: idx_parking_locations_wilaya; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parking_locations_wilaya ON public.parking_locations USING btree (wilaya);


--
-- TOC entry 4241 (class 1259 OID 42315)
-- Name: idx_parking_spots_location_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parking_spots_location_id ON public.parking_spots USING btree (parking_location_id);


--
-- TOC entry 4246 (class 1259 OID 42313)
-- Name: idx_reservations_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reservations_dates ON public.reservations USING btree (reservation_start, reservation_end);


--
-- TOC entry 4247 (class 1259 OID 42314)
-- Name: idx_reservations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reservations_status ON public.reservations USING btree (status);


--
-- TOC entry 4248 (class 1259 OID 42312)
-- Name: idx_reservations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reservations_user_id ON public.reservations USING btree (user_id);


--
-- TOC entry 4227 (class 1259 OID 42316)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 4228 (class 1259 OID 42317)
-- Name: idx_users_matricule; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_matricule ON public.users USING btree (matricule);


--
-- TOC entry 4253 (class 1259 OID 42318)
-- Name: idx_violations_matricule; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_violations_matricule ON public.traffic_violations USING btree (matricule);


--
-- TOC entry 4269 (class 2620 OID 42192)
-- Name: parking_locations update_coordinates_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_coordinates_trigger BEFORE INSERT OR UPDATE OF latitude, longitude ON public.parking_locations FOR EACH ROW EXECUTE FUNCTION public.update_parking_coordinates();


--
-- TOC entry 4260 (class 2606 OID 42161)
-- Name: companies companies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4261 (class 2606 OID 42186)
-- Name: parking_locations parking_locations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_locations
    ADD CONSTRAINT parking_locations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- TOC entry 4262 (class 2606 OID 42206)
-- Name: parking_spots parking_spots_parking_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_spots
    ADD CONSTRAINT parking_spots_parking_location_id_fkey FOREIGN KEY (parking_location_id) REFERENCES public.parking_locations(id) ON DELETE CASCADE;


--
-- TOC entry 4266 (class 2606 OID 42258)
-- Name: pricing_rules pricing_rules_parking_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_parking_location_id_fkey FOREIGN KEY (parking_location_id) REFERENCES public.parking_locations(id) ON DELETE CASCADE;


--
-- TOC entry 4263 (class 2606 OID 42234)
-- Name: reservations reservations_parking_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_parking_location_id_fkey FOREIGN KEY (parking_location_id) REFERENCES public.parking_locations(id);


--
-- TOC entry 4264 (class 2606 OID 42239)
-- Name: reservations reservations_parking_spot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_parking_spot_id_fkey FOREIGN KEY (parking_spot_id) REFERENCES public.parking_spots(id) ON DELETE SET NULL;


--
-- TOC entry 4265 (class 2606 OID 42229)
-- Name: reservations reservations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4268 (class 2606 OID 42305)
-- Name: special_event_areas special_event_areas_special_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_event_areas
    ADD CONSTRAINT special_event_areas_special_event_id_fkey FOREIGN KEY (special_event_id) REFERENCES public.special_events(id) ON DELETE CASCADE;


--
-- TOC entry 4267 (class 2606 OID 42277)
-- Name: traffic_violations traffic_violations_parking_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.traffic_violations
    ADD CONSTRAINT traffic_violations_parking_location_id_fkey FOREIGN KEY (parking_location_id) REFERENCES public.parking_locations(id);


-- Completed on 2025-09-19 15:23:20

--
-- PostgreSQL database dump complete
--

