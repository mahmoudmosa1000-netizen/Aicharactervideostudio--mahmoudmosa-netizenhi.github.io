-- ─── backend/db/schema.sql ────────────────────────────────────────────────────
-- PostgreSQL-Datenbankschema für AI Character Video Studio.
-- Ausführen mit: psql -U postgres -d ai_video_studio -f schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Erweiterungen
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Tabelle: characters ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS characters (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    description     TEXT            NOT NULL,
    locked          BOOLEAN         NOT NULL DEFAULT FALSE,
    color           VARCHAR(20)     NOT NULL DEFAULT '#a78bfa',

    -- Visuelle Merkmale (von KI analysiert)
    coloring        VARCHAR(200),
    eyes            VARCHAR(200),
    clothing        VARCHAR(200),
    accessories     VARCHAR(200),
    build           VARCHAR(200),
    style           VARCHAR(200),
    consistency_note TEXT,

    -- Persönlichkeit
    traits          TEXT[]          DEFAULT '{}',

    -- Zähler
    videos_count    INTEGER         NOT NULL DEFAULT 0,
    series_count    INTEGER         NOT NULL DEFAULT 0,

    -- Zeitstempel
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ─── Tabelle: videos ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS videos (
    id              SERIAL          PRIMARY KEY,
    character_id    INTEGER         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

    -- Eingabe
    scene           TEXT            NOT NULL,
    camera          TEXT,
    style           VARCHAR(50)     NOT NULL DEFAULT 'studio-ghibli',
    duration        VARCHAR(10)     NOT NULL DEFAULT '5s',
    ratio           VARCHAR(10)     NOT NULL DEFAULT '9:16',
    model           VARCHAR(50)     NOT NULL DEFAULT 'kling',

    -- Generierter Prompt
    prompt          TEXT,

    -- Ergebnis
    status          VARCHAR(20)     NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'processing', 'done', 'error')),
    video_url       TEXT,
    thumbnail_url   TEXT,
    error_message   TEXT,

    -- Zeitstempel
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- ─── Tabelle: stories ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
    id              SERIAL          PRIMARY KEY,
    character_id    INTEGER         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    idea            TEXT            NOT NULL,

    -- Zeitstempel
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ─── Tabelle: story_scenes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_scenes (
    id              SERIAL          PRIMARY KEY,
    story_id        INTEGER         NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    video_id        INTEGER         REFERENCES videos(id) ON DELETE SET NULL,

    scene_number    SMALLINT        NOT NULL CHECK (scene_number BETWEEN 1 AND 5),
    title           VARCHAR(200)    NOT NULL,
    description     TEXT            NOT NULL,
    camera          TEXT,
    mood            VARCHAR(100),
    duration        VARCHAR(10)     DEFAULT '5s',

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ─── Tabelle: character_images ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS character_images (
    id              SERIAL          PRIMARY KEY,
    character_id    INTEGER         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    url             TEXT            NOT NULL,
    filename        VARCHAR(255)    NOT NULL,
    is_primary      BOOLEAN         NOT NULL DEFAULT FALSE,
    uploaded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ─── Indizes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_videos_character_id  ON videos(character_id);
CREATE INDEX IF NOT EXISTS idx_videos_status        ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created_at    ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_scenes_story   ON story_scenes(story_id);
CREATE INDEX IF NOT EXISTS idx_stories_character    ON stories(character_id);

-- ─── Trigger: updated_at automatisch setzen ───────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_characters_updated_at
    BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Trigger: videos_count automatisch aktualisieren ─────────────────────────
CREATE OR REPLACE FUNCTION update_character_video_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE characters SET videos_count = videos_count + 1 WHERE id = NEW.character_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE characters SET videos_count = videos_count - 1 WHERE id = OLD.character_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_video_count
    AFTER INSERT OR DELETE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_character_video_count();

-- ─── Beispieldaten ────────────────────────────────────────────────────────────
INSERT INTO characters (name, description, locked, color, coloring, eyes, clothing, accessories, build, style, traits)
VALUES
(
    'Mochi',
    'Orange & white cat in traditional Japanese clothing with floral headscarf and gentle round eyes',
    TRUE, '#f59e0b',
    'Orange & white fur', 'Large, round, amber',
    'Yukata + floral headscarf', 'Wicker basket, apron',
    'Small, soft proportions', 'Studio Ghibli–inspired animation',
    ARRAY['Curious', 'Warm', 'Creative']
),
(
    'Captain Rex',
    'Navy blue penguin in a captain''s coat with gold buttons, peaked cap and tiny brass telescope',
    FALSE, '#4f9cf9',
    'Navy & white plumage', 'Sharp, dark, determined',
    'Captain''s coat + peaked cap', 'Brass telescope, map scroll',
    'Stocky, upright posture', '2D cartoon, flat design',
    ARRAY['Adventurous', 'Bold', 'Loyal']
)
ON CONFLICT DO NOTHING;
