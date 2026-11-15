create table cards(id text primary key,name text not null,kind text not null check(kind in('player','event')),variant text not null default 'base',rarity int not null check(rarity between 0 and 3),era text,base_value int not null,available_from timestamptz,available_until timestamptz);
create table card_stats(card_id text primary key references cards(id),avg_score numeric default 50,kd numeric default 1,updated_at timestamptz default now());
create table profiles(id uuid primary key references auth.users(id) on delete cascade,username text,drachmas int not null default 500);
create table inventory(id uuid primary key default gen_random_uuid(),user_id uuid references profiles(id) on delete cascade,card_id text references cards(id),got_at timestamptz default now());
alter table cards enable row level security;alter table card_stats enable row level security;alter table profiles enable row level security;alter table inventory enable row level security;
create policy "read" on cards for select using(true);create policy "read" on card_stats for select using(true);
create policy "read" on profiles for select using(true);create policy "read" on inventory for select using(true);
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,username) values(new.id,coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)));return new;end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
-- PLACEHOLDER cards: rename to real players. Seasonal cards only drop inside their date window.
insert into cards(id,name,kind,variant,rarity,era,base_value,available_from,available_until) values
('p_delta','Player Delta','player','base',0,null,50,null,null),
('p_echo','Player Echo','player','base',0,null,50,null,null),
('p_gamma','Player Gamma','player','base',1,null,150,null,null),
('p_beta','Player Beta','player','base',1,null,150,null,null),
('p_alpha','Player Alpha','player','base',2,null,400,null,null),
('p_omega','Player Omega','player','base',3,null,1000,null,null),
('p_alpha_hw','Player Alpha (Halloween)','player','halloween',3,null,900,'2026-10-20','2026-11-02'),
('p_gamma_xmas','Player Gamma (Christmas)','player','christmas',3,null,800,'2026-11-01','2026-12-31'),
('e_og','OG Era','event','base',3,'The original squad',900,null,null),
('e_house','FaZe House Era','event','base',2,'Content house days',500,null,null);
-- placeholder stats; the stats pipeline overwrites these through /api/stats
insert into card_stats(card_id,avg_score,kd) select id,round((40+random()*30)::numeric),round((0.8+random()*0.8)::numeric,2) from cards;
