-- server/migrations/001_game_schema.sql
-- RDS Postgres (gwave DB) — schema `game`   psql -f 001_game_schema.sql
CREATE SCHEMA IF NOT EXISTS game;

-- gwave users table (Cognito sub) ကို FK ချိတ် — gwave DB ထဲ users(id uuid) ရှိပြီးဟု ယူဆ
CREATE TABLE IF NOT EXISTS game.players (
  user_id       text PRIMARY KEY,            -- Cognito sub
  display_name  text NOT NULL DEFAULT 'Pilot',
  mmr           int  NOT NULL DEFAULT 1000,
  level         int  NOT NULL DEFAULT 1,
  xp            int  NOT NULL DEFAULT 0,
  kills         int  NOT NULL DEFAULT 0,
  deaths        int  NOT NULL DEFAULT 0,
  wins          int  NOT NULL DEFAULT 0,
  drone_kills   int  NOT NULL DEFAULT 0,
  matches       int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game.matches (
  id            bigserial PRIMARY KEY,
  mode          text NOT NULL,               -- SANDBOX | STRIKE | WARZONE | DRONE_OPS
  map           text NOT NULL DEFAULT 'valley',
  room_id       text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  winner_team   text,
  ivs_replay_url text
);

CREATE TABLE IF NOT EXISTS game.match_players (
  match_id      bigint REFERENCES game.matches(id) ON DELETE CASCADE,
  user_id       text   REFERENCES game.players(user_id),
  kills int DEFAULT 0, deaths int DEFAULT 0, damage int DEFAULT 0,
  drone_strikes int DEFAULT 0, placement int,
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS game.items (
  id       text PRIMARY KEY,                 -- 'skin_forest', 'prop_blade7', ...
  type     text NOT NULL,                    -- skin | drone_part | emote | voice_pack
  name     text NOT NULL,
  price    int  NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GPAY',
  meta     jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS game.inventory (
  user_id  text REFERENCES game.players(user_id),
  item_id  text REFERENCES game.items(id),
  source   text NOT NULL DEFAULT 'purchase', -- purchase | unlock | reward
  equipped boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS game.drone_builds (
  user_id  text REFERENCES game.players(user_id),
  name     text NOT NULL DEFAULT 'My Build',
  build    jsonb NOT NULL,                   -- {propeller, motor, battery, frame, colors}
  rates    jsonb,                            -- controller rates/bindings (config.js format)
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_players_mmr ON game.players (mmr DESC);
CREATE INDEX IF NOT EXISTS idx_players_kills ON game.players (kills DESC);

-- leaderboard view (season-less starter — season table ကို P7.5 extended မှာထည့်)
CREATE OR REPLACE VIEW game.leaderboard AS
  SELECT user_id, display_name, mmr, kills, deaths, drone_kills, wins,
         RANK() OVER (ORDER BY mmr DESC) AS rank
  FROM game.players;
