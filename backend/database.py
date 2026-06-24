import sqlite3
import os
from typing import Optional, List
from models import (
    Source,
    ConflictEvent,
    ReconciliationLogEntry,
    ConfidenceHistoryEntry,
    DecaySettings,
)

DB_PATH = os.path.join(os.path.dirname(__file__), "synapse_meta.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def db_init():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Sources table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        url TEXT,
        file_path TEXT,
        content TEXT DEFAULT '',
        ingested_at TEXT NOT NULL,
        last_synced_at TEXT,
        status TEXT NOT NULL
    )
    """)
    # Ensure content column exists on previously-created tables
    try:
        cursor.execute("ALTER TABLE sources ADD COLUMN content TEXT DEFAULT ''")
    except:
        pass
    
    # 2. Conflicts table (reconciliation_log/Inbox queue)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        old_node_summary TEXT NOT NULL,
        old_node_date TEXT NOT NULL,
        old_node_source TEXT NOT NULL,
        new_node_summary TEXT NOT NULL,
        new_node_date TEXT NOT NULL,
        new_node_source TEXT NOT NULL,
        topic TEXT NOT NULL,
        relationship TEXT NOT NULL,
        llm_confidence REAL NOT NULL,
        status TEXT NOT NULL,
        resolution_note TEXT,
        created_at TEXT NOT NULL
    )
    """)
    
    # 3. Typed reconciliation log (audit trail/history of changes)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reconciliation_log (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        topic TEXT NOT NULL,
        old_summary TEXT,
        new_summary TEXT,
        source TEXT,
        created_at TEXT NOT NULL
    )
    """)
    
    # 4. Confidence history tracking
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS confidence_history (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        value_summary TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        reason TEXT NOT NULL,
        date TEXT NOT NULL
    )
    """)
    
    # 5. Decay settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS decay_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        decay_start_days INTEGER NOT NULL,
        forget_threshold_days INTEGER NOT NULL
    )
    """)
    
    # Insert default decay settings if not present
    cursor.execute("SELECT COUNT(*) FROM decay_settings")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO decay_settings (id, decay_start_days, forget_threshold_days) VALUES (1, 60, 180)")
        
    # Seed default data exactly once, tracked in db_metadata
    cursor.execute("CREATE TABLE IF NOT EXISTS db_metadata (key TEXT PRIMARY KEY, value TEXT)")
    cursor.execute("SELECT COUNT(*) FROM db_metadata WHERE key='seeded'")
    is_seeded = cursor.fetchone()[0] > 0
    
    cursor.execute("SELECT COUNT(*) FROM sources")
    has_sources = cursor.fetchone()[0] > 0
    
    if not is_seeded or not has_sources:
        # Clear database to prevent primary key conflicts on re-seeding
        cursor.execute("DELETE FROM db_metadata WHERE key='seeded'")
        cursor.execute("DELETE FROM sources WHERE id IN ('1', '2', '3')")
        cursor.execute("DELETE FROM conflicts WHERE id IN ('1', '2', '3')")
        cursor.execute("DELETE FROM reconciliation_log WHERE id IN ('log1', 'log2', 'log3', 'log4', 'log5', 'log6', 'log7')")
        cursor.execute("DELETE FROM confidence_history WHERE id IN ('ch1', 'ch2', 'ch3', 'ch4')")

        # Seed default sources
        cursor.execute("INSERT INTO sources (id, type, label, url, ingested_at, status) VALUES ('1', 'article', 'DESIGN-elevenlabs.md', NULL, 'Jun 24, 2026', 'ready')")
        cursor.execute("INSERT INTO sources (id, type, label, url, ingested_at, status) VALUES ('2', 'article', 'AGENTS.md', NULL, 'Jun 24, 2026', 'ready')")
        cursor.execute("INSERT INTO sources (id, type, label, url, ingested_at, status) VALUES ('3', 'article', 'cognee_hackathon.md', NULL, 'Jun 29, 2026', 'ready')")
        
        # Seed default conflicts
        cursor.execute("""
        INSERT INTO conflicts (id, old_node_summary, old_node_date, old_node_source, new_node_summary, new_node_date, new_node_source, topic, relationship, llm_confidence, status, created_at)
        VALUES ('1', 'Keep canvas (#010102) as the only background — the whole app stays dark.', 'Jun 29, 2026', 'cognee_hackathon.md', 'The base canvas is off-white (#f5f5f5) holding warm near-black ink (#292524) — no developer-tools dark canvas.', 'Jun 24, 2026', 'DESIGN-elevenlabs.md', 'Canvas Theme', 'contradicts', 0.94, 'pending', '2026-06-24T14:00:00Z')
        """)
        cursor.execute("""
        INSERT INTO conflicts (id, old_node_summary, old_node_date, old_node_source, new_node_summary, new_node_date, new_node_source, topic, relationship, llm_confidence, status, created_at)
        VALUES ('2', 'FastAPI backend has zero access control of its own (unprotected endpoints).', 'Jun 29, 2026', 'cognee_hackathon.md', 'FastAPI backend requires shared-secret access control via X-Synapse-Key header.', 'Jun 24, 2026', 'AGENTS.md', 'Backend Security', 'supersedes', 0.88, 'pending', '2026-06-24T14:05:00Z')
        """)
        cursor.execute("""
        INSERT INTO conflicts (id, old_node_summary, old_node_date, old_node_source, new_node_summary, new_node_date, new_node_source, topic, relationship, llm_confidence, status, created_at)
        VALUES ('3', 'Outfit (Headlines) — brings a futuristic geometric character suitable for a \"memory graph\" product.', 'Jun 29, 2026', 'cognee_hackathon.md', 'Display runs Waldenburg Light at weight 300 — the editorial signature.', 'Jun 24, 2026', 'DESIGN-elevenlabs.md', 'Typography Choice', 'contradicts', 0.82, 'pending', '2026-06-24T14:10:00Z')
        """)
        
        # Seed reconciliation log
        cursor.execute("INSERT INTO reconciliation_log (id, event_type, topic, new_summary, source, created_at) VALUES ('log1', 'added', 'Canvas Theme', 'Off-white (#f5f5f5) canvas background', 'DESIGN-elevenlabs.md', '2026-06-24T14:00:00Z')")
        cursor.execute("INSERT INTO reconciliation_log (id, event_type, topic, new_summary, source, created_at) VALUES ('log2', 'added', 'Backend Security', 'FastAPI header checking via X-Synapse-Key', 'AGENTS.md', '2026-06-24T14:00:00Z')")
        cursor.execute("INSERT INTO reconciliation_log (id, event_type, topic, new_summary, source, created_at) VALUES ('log3', 'added', 'Typography Choice', 'Waldenburg Light serif font', 'DESIGN-elevenlabs.md', '2026-06-24T14:00:00Z')")
        cursor.execute("INSERT INTO reconciliation_log (id, event_type, topic, old_summary, new_summary, source, created_at) VALUES ('log4', 'changed', 'Canvas Theme', 'Dark canvas (#010102)', 'Off-white (#f5f5f5) canvas', 'DESIGN-elevenlabs.md', '2026-06-24T14:00:00Z')")
        cursor.execute("INSERT INTO reconciliation_log (id, event_type, topic, old_summary, created_at) VALUES ('log5', 'removed', 'Canvas Theme', 'Dark layout default', '2026-06-24T14:00:00Z')")
        cursor.execute("INSERT INTO reconciliation_log (id, event_type, topic, old_summary, created_at) VALUES ('log6', 'removed', 'Typography Choice', 'Outfit sans font', '2026-06-24T14:00:00Z')")
        cursor.execute("INSERT INTO reconciliation_log (id, event_type, topic, new_summary, created_at) VALUES ('log7', 'new_decision', 'Backend Security', 'CORS restricted to frontend domain', '2026-06-24T14:00:00Z')")
        
        # Seed confidence history
        cursor.execute("INSERT INTO confidence_history (id, topic, value_summary, confidence_score, reason, date) VALUES ('ch1', 'Canvas Theme', 'Dark canvas (#010102)', 0.92, 'initial_ingest', 'Jun 29, 2026')")
        cursor.execute("INSERT INTO confidence_history (id, topic, value_summary, confidence_score, reason, date) VALUES ('ch2', 'Canvas Theme', 'Dark canvas (#010102)', 0.80, 'decay_tick', 'Jul 1, 2026')")
        cursor.execute("INSERT INTO confidence_history (id, topic, value_summary, confidence_score, reason, date) VALUES ('ch3', 'Canvas Theme', 'Dark canvas (#010102)', 0.52, 'decay_tick', 'Jul 5, 2026')")
        cursor.execute("INSERT INTO confidence_history (id, topic, value_summary, confidence_score, reason, date) VALUES ('ch4', 'Canvas Theme', 'Off-white (#f5f5f5) canvas', 0.95, 'superseded', 'Jun 24, 2026')")
        
        # Mark as seeded
        cursor.execute("INSERT INTO db_metadata (key, value) VALUES ('seeded', '1')")

    conn.commit()
    conn.close()

# Sources CRUD
def db_save_source(s: Source):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO sources (id, type, label, url, file_path, ingested_at, last_synced_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        status=excluded.status,
        last_synced_at=excluded.last_synced_at,
        file_path=excluded.file_path
    """, (s.id, s.type, s.label, s.url, s.filePath, s.ingestedAt, s.lastSyncedAt, s.status))
    conn.commit()
    conn.close()

def db_get_sources() -> List[Source]:
    conn = get_db_connection()
    cursor = conn.cursor()

    # Auto-fix: sources stuck in "processing" for > 120 seconds → "ready"
    try:
        from datetime import datetime, timezone, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(seconds=120)).isoformat()
        cursor.execute("UPDATE sources SET status='ready' WHERE status='processing' AND ingested_at < ?", (cutoff,))
    except:
        pass

    cursor.execute("SELECT * FROM sources ORDER BY ingested_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [
        Source(
            id=r["id"],
            type=r["type"],
            label=r["label"],
            url=r["url"],
            filePath=r["file_path"],
            ingestedAt=r["ingested_at"],
            lastSyncedAt=r["last_synced_at"],
            status=r["status"]
        )
        for r in rows
    ]

def db_update_source_content(source_id: str, content: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE sources SET content = ? WHERE id = ?", (content, source_id))
    conn.commit()
    conn.close()

def db_get_source_content(source_label: str) -> Optional[str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT content FROM sources WHERE label = ?", (source_label,))
    row = cursor.fetchone()
    conn.close()
    return row["content"] if row else None

def db_delete_source(source_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Get the source label first
    cursor.execute("SELECT label FROM sources WHERE id=?", (source_id,))
    row = cursor.fetchone()
    if row:
        label = row["label"]
        
        # 2. Find conflicts linked to this source to get their topics
        cursor.execute("SELECT DISTINCT topic FROM conflicts WHERE old_node_source=? OR new_node_source=?", (label, label))
        topics = [r["topic"] for r in cursor.fetchall()]
        
        # 3. Delete conflicts
        cursor.execute("DELETE FROM conflicts WHERE old_node_source=? OR new_node_source=?", (label, label))
        
        # 4. Delete reconciliation_log entries
        cursor.execute("DELETE FROM reconciliation_log WHERE source=?", (label,))
        
        # 5. Delete confidence_history for these topics
        if topics:
            placeholders = ",".join("?" for _ in topics)
            cursor.execute(f"DELETE FROM confidence_history WHERE topic IN ({placeholders})", topics)
            
    # 6. Delete the source itself
    cursor.execute("DELETE FROM sources WHERE id=?", (source_id,))
    
    # If no sources left, completely clear conflicts, log, and history tables
    cursor.execute("SELECT COUNT(*) FROM sources")
    if cursor.fetchone()[0] == 0:
        cursor.execute("DELETE FROM conflicts")
        cursor.execute("DELETE FROM reconciliation_log")
        cursor.execute("DELETE FROM confidence_history")
        cursor.execute("DELETE FROM db_metadata WHERE key='seeded'")
        
    conn.commit()
    conn.close()

# Conflicts CRUD
def db_save_conflict(c: ConflictEvent):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO conflicts (
        id, old_node_summary, old_node_date, old_node_source,
        new_node_summary, new_node_date, new_node_source,
        topic, relationship, llm_confidence, status, resolution_note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        status=excluded.status,
        resolution_note=excluded.resolution_note
    """, (
        c.id, c.oldNodeSummary, c.oldNodeDate, c.oldNodeSource,
        c.newNodeSummary, c.newNodeDate, c.newNodeSource,
        c.topic, c.relationship, c.llmConfidence, c.status, c.resolutionNote, c.createdAt
    ))
    conn.commit()
    conn.close()

def db_get_conflicts(include_resolved: bool = True) -> List[ConflictEvent]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if include_resolved:
        cursor.execute("SELECT * FROM conflicts ORDER BY created_at DESC")
    else:
        cursor.execute("SELECT * FROM conflicts WHERE status='pending' ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [
        ConflictEvent(
            id=r["id"],
            oldNodeSummary=r["old_node_summary"],
            oldNodeDate=r["old_node_date"],
            oldNodeSource=r["old_node_source"],
            newNodeSummary=r["new_node_summary"],
            newNodeDate=r["new_node_date"],
            newNodeSource=r["new_node_source"],
            topic=r["topic"],
            relationship=r["relationship"],
            llmConfidence=r["llm_confidence"],
            status=r["status"],
            resolutionNote=r["resolution_note"],
            createdAt=r["created_at"]
        )
        for r in rows
    ]

# Reconciliation Log CRUD
def db_save_reconciliation_log_entry(e: ReconciliationLogEntry):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO reconciliation_log (id, event_type, topic, old_summary, new_summary, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (e.id, e.eventType, e.topic, e.oldSummary, e.newSummary, e.source, e.createdAt))
    conn.commit()
    conn.close()

def db_get_reconciliation_log() -> List[ReconciliationLogEntry]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reconciliation_log ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [
        ReconciliationLogEntry(
            id=r["id"],
            eventType=r["event_type"],
            topic=r["topic"],
            oldSummary=r["old_summary"],
            newSummary=r["new_summary"],
            source=r["source"],
            createdAt=r["created_at"]
        )
        for r in rows
    ]

# Confidence History CRUD
def db_save_confidence_history_entry(e: ConfidenceHistoryEntry):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO confidence_history (id, topic, value_summary, confidence_score, reason, date)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (e.id, e.topic, e.valueSummary, e.confidenceScore, e.reason, e.date))
    conn.commit()
    conn.close()

def db_get_confidence_history(topic: Optional[str] = None) -> List[ConfidenceHistoryEntry]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if topic:
        cursor.execute("SELECT * FROM confidence_history WHERE topic=? ORDER BY date ASC", (topic,))
    else:
        cursor.execute("SELECT * FROM confidence_history ORDER BY date ASC")
    rows = cursor.fetchall()
    conn.close()
    return [
        ConfidenceHistoryEntry(
            id=r["id"],
            topic=r["topic"],
            valueSummary=r["value_summary"],
            confidenceScore=r["confidence_score"],
            reason=r["reason"],
            date=r["date"]
        )
        for r in rows
    ]

# Decay Settings CRUD
def db_get_decay_settings() -> DecaySettings:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT decay_start_days, forget_threshold_days FROM decay_settings WHERE id=1")
    row = cursor.fetchone()
    conn.close()
    return DecaySettings(
        decayStartDays=row["decay_start_days"],
        forgetThresholdDays=row["forget_threshold_days"]
    )

def db_update_decay_settings(s: DecaySettings):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE decay_settings
    SET decay_start_days=?, forget_threshold_days=?
    WHERE id=1
    """, (s.decayStartDays, s.forgetThresholdDays))
    conn.commit()
    conn.close()
