create table public.residents (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references public.barangays(id) on delete restrict default app.current_barangay_id(),
  first_name text not null,
  last_name text not null,
  middle_name text,
  ext_name text,
  age numeric,
  household_id uuid references public.households(id) on delete set null,
  is_deceased boolean not null default false,
  type_of_resident text not null check (type_of_resident in ('Non-migrant','Migrant','Transient')),
  philsys_card_no text,
  date_of_birth date not null,
  place_of_birth text not null,
  residence_of_mother_upon_birth text,
  sex text not null check (sex in ('Male','Female')),
  gender text check (gender in (
    'Lesbian','Gay','Bisexual','Transgender','Queer','Intersex','Asexual','Others (specify)')),
  gender_other text,
  civil_status text not null check (civil_status in (
    'Single/Never Married','Married','Common Law/Live-in','Widowed','Divorced','Separated','Annulled','Unknown')),
  pregnant_woman boolean not null default false,
  highest_educational_attainment text check (highest_educational_attainment in (
    'No education','Pre-school','Elementary Level','Elementary Graduate','High School Level',
    'High School Graduate','Junior HS','Junior HS Graduate','Senior HS Level','Senior HS Graduate',
    'Vocational/Tech','College Level','College Graduate','Post-graduate')),
  profession_occupation text,
  mother_maiden_first_name text,
  mother_maiden_middle_name text,
  mother_maiden_last_name text,
  email_address text,
  mobile_number text,
  tel_number text,
  region text not null,
  province text not null,
  city_municipality text not null,
  barangay text not null, -- denormalized display name, distinct from barangay_id
  sitio_purok text,
  house_block_lot_no text,
  street_name text,
  subdivision_village text,
  zip_code text,
  blood_type text check (blood_type in ('A+','A-','O+','O-','B+','B-','AB+','AB-')),
  height_m numeric,
  weight_kg numeric,
  complexion text check (complexion in ('Fair','Medium','Dark')),
  nationality text not null check (nationality in (
    'Filipino Citizen','Dual Citizen','Foreign Citizen','No Citizenship')),
  ethnicity text check (ethnicity in (
    'Aeta','Agta','Ati','Ayta Mag-antsi','Ayta Magbukon','Ayta Mag-indi','Ayta Abellen','Badjao',
    'Bagobo','Bago','Balangao','Batak','B''laan','Bugkalot','Bukidnon','Bontoc','Dumagat','Gaddang',
    'Hanunuo Mangyan','Higaonon','Ilongot','Ifugao','Iraya Mangyan','Isneg','Itawis','Ivatan','Iwak',
    'Jama Mapun','Kabihug','Kalagan','Kalanguya','Kalinga','Kankanaey','Kaolo','Ke''ney','Kinaray-a',
    'Kolibugan','Kagayanen','Lambangian','Langilan Manobo','Maguindanao','Mandaya','Mamanwa','Mansaka',
    'Manobo','Mangyan','Matigsalug','Molbog','Palawano','Panay Bukidnon','Pala''wan','Pankalis',
    'Remontado','Sama Banguingui','Sama Dilaut','Subanon','Tagbanwa','Tagakaulo','Teduray','T''boli',
    'Talaandig','Tau''t Batu','Tingguian','Tinggian','Tumandok','Ubo','Yakan','Other Local Ethnicity',
    'Other Foreign Ethnicity','Not Reported')),
  religion text not null check (religion in (
    'Roman Catholic','Islam','Iglesia ni Cristo','Christian','Aglipayan Church','Seventh-day Adventist',
    'Bible Baptist Church','Jehovah''s Witnesses','Church of Jesus Christ of Latter-day Saints',
    'United Church of Christ in the Philippines','Others (specify)')),
  religion_other text,
  registered_voter boolean not null default false,
  resident_voter boolean not null default false,
  last_voted_year numeric,
  government_assistance_programs jsonb,
  government_assistance_other text,
  employed boolean not null default false,
  unemployed boolean not null default false,
  ofw boolean not null default false,
  indigenous_people boolean not null default false,
  student boolean not null default false,
  out_of_school_children boolean not null default false,
  out_of_school_youth boolean not null default false,
  migrant boolean not null default false,
  refugee boolean not null default false,
  senior_citizen boolean not null default false,
  pwd boolean not null default false,
  single_solo_parent boolean not null default false,
  data_privacy_consent boolean not null default false,
  consent_signature_date date,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create trigger set_updated_at before update on public.residents
  for each row execute function app.set_updated_at();

create index idx_residents_name on public.residents (last_name, first_name);
create index idx_residents_household_id on public.residents (household_id);
create index idx_residents_barangay_name on public.residents (barangay_id, last_name, first_name);

alter table public.residents enable row level security;
alter table public.residents force row level security;

create policy residents_select on public.residents for select
  using (barangay_id = app.current_barangay_id() and auth.role() = 'authenticated');

create policy residents_insert on public.residents for insert
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy residents_update on public.residents for update
  using (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'))
  with check (barangay_id = app.current_barangay_id() and app.current_role() in ('admin','staff'));

create policy residents_delete on public.residents for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
