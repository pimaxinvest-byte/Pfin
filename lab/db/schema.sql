CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agency_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','agent','readonly')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  phone text,
  given_name text,
  surnames text,
  nationality text,
  sex text,
  date_of_birth date,
  passport_no text,
  passport_country text,
  passport_expiry date,
  origin_country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_catalog (
  id text PRIMARY KEY,
  name_es text NOT NULL,
  name_en text NOT NULL,
  name_fr text NOT NULL,
  fee_eur numeric(12,2) NOT NULL,
  official_tasa numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES clients(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','quoted','engaged','filed','closed','lost')),
  lang text NOT NULL DEFAULT 'es',
  profile text NOT NULL DEFAULT 'retiree' CHECK (profile IN ('retiree','nomad','worker')),
  dest_ccaa text NOT NULL DEFAULT 'andalucia',
  days_es int NOT NULL DEFAULT 0,
  from_abroad boolean NOT NULL DEFAULT true,
  family_count int NOT NULL DEFAULT 0,
  age int,
  fx_cad_eur numeric(10,4) NOT NULL DEFAULT 0.65,
  oas_cad numeric(14,2) NOT NULL DEFAULT 0,
  cpp_cad numeric(14,2) NOT NULL DEFAULT 0,
  rrif_cad numeric(14,2) NOT NULL DEFAULT 0,
  tfsa_cad numeric(14,2) NOT NULL DEFAULT 0,
  wealth_eur numeric(16,2) NOT NULL DEFAULT 0,
  resident_est boolean,
  irpf_net_eur numeric(14,2),
  can_wh_eur numeric(14,2),
  ftc_eur numeric(14,2),
  fees_net_eur numeric(14,2),
  iva_eur numeric(14,2),
  tasas_eur numeric(14,2),
  total_eur numeric(14,2),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cases_client_idx ON cases (client_id);
CREATE INDEX IF NOT EXISTS cases_status_idx ON cases (status);

CREATE TABLE IF NOT EXISTS case_services (
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  service_id text NOT NULL REFERENCES service_catalog(id),
  recommended boolean NOT NULL DEFAULT true,
  fee_eur numeric(12,2) NOT NULL,
  PRIMARY KEY (case_id, service_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other',
  filename text NOT NULL,
  mime text,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  fees_net_eur numeric(14,2) NOT NULL,
  iva_eur numeric(14,2) NOT NULL,
  tasas_eur numeric(14,2) NOT NULL,
  total_eur numeric(14,2) NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, version)
);

INSERT INTO service_catalog (id, name_es, name_en, name_fr, fee_eur, official_tasa, sort_order) VALUES
 ('nie','NIE (EX-15)','NIE (EX-15)','NIE (EX-15)',350,9.84,10),
 ('niepoa','NIE desde el extranjero','NIE from abroad','NIE depuis l''etranger',400,0,20),
 ('padron','Empadronamiento','Municipal registration','Empadronamiento',160,0,30),
 ('tie','TIE / huellas','TIE / fingerprints','TIE / empreintes',200,16.08,40),
 ('nlv','Residencia no lucrativa','Non-lucrative residence','Residence non lucrative',1595,10.94,50),
 ('nlvfam','Familiar no lucrativa','NLV family member','Membre famille NLV',400,0,60),
 ('dnv','Visado nomada digital','Digital nomad visa','Visa nomade digital',1195,0,70),
 ('arraigo','Arraigo','Arraigo','Arraigo',800,38.28,80),
 ('taxrep','Informe fiscal Canada-Espana','Canada-Spain tax report','Rapport fiscal',1090,0,90),
 ('m100','Modelo 100 IRPF','Form 100 PIT','Modele 100',465,0,100),
 ('m720','Modelo 720','Form 720','Modele 720',350,0,110),
 ('m714','Patrimonio / ITSGF','Wealth tax','Patrimoine',530,0,120),
 ('trad','Traduccion jurada','Sworn translation','Traduction',80,0,130),
 ('apos','Apostilla','Apostille','Apostille',140,0,140)
ON CONFLICT (id) DO UPDATE SET fee_eur = EXCLUDED.fee_eur, official_tasa = EXCLUDED.official_tasa;
