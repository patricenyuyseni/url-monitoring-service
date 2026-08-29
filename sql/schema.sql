CREATE TABLE monitors (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    url TEXT NOT NULL,
    interval_seconds INTEGER NOT NULL DEFAULT 60
        CHECK (interval_seconds BETWEEN 10 AND 3600),
    expected_status INTEGER NOT NULL DEFAULT 200
        CHECK (expected_status BETWEEN 100 AND 599),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checks (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    monitor_id INTEGER NOT NULL
        REFERENCES monitors(id)
        ON DELETE CASCADE,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ok BOOLEAN NOT NULL,
    status_code INTEGER,
    latency_ms INTEGER,
    error TEXT,

    CHECK (status_code IS NULL OR status_code BETWEEN 100 AND 599),
    CHECK (latency_ms IS NULL OR latency_ms >= 0)
);

CREATE TABLE incidents (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    monitor_id INTEGER NOT NULL
        REFERENCES monitors(id)
        ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    cause TEXT,

    CHECK (resolved_at IS NULL OR resolved_at >= started_at)
);

CREATE INDEX checks_monitor_checked_at_idx
ON checks (monitor_id, checked_at DESC);

CREATE INDEX incidents_monitor_started_at_idx
ON incidents (monitor_id, started_at DESC);

CREATE UNIQUE INDEX incidents_one_open_per_monitor
ON incidents (monitor_id)
WHERE resolved_at IS NULL;