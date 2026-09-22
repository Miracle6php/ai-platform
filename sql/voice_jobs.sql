CREATE TABLE IF NOT EXISTS voice_jobs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,

    status ENUM('queued', 'processing', 'completed', 'failed')
        NOT NULL DEFAULT 'queued',
    progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
    status_message VARCHAR(255) DEFAULT 'Waiting for processing...',

    source_audio_path VARCHAR(512) NOT NULL,
    voice_mode ENUM('library', 'clone') NOT NULL,
    voice_id VARCHAR(64) DEFAULT NULL,
    clone_reference_id CHAR(36) DEFAULT NULL,

    quality ENUM('standard', 'high', 'premium') NOT NULL DEFAULT 'standard',
    pitch ENUM('natural', 'lower', 'higher') NOT NULL DEFAULT 'natural',
    stability ENUM('balanced', 'stable', 'expressive') NOT NULL DEFAULT 'balanced',

    credits_estimated INT UNSIGNED NOT NULL DEFAULT 0,
    credits_charged INT UNSIGNED DEFAULT NULL,

    result_audio_path VARCHAR(512) DEFAULT NULL,
    error_message VARCHAR(255) DEFAULT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_status_created (status, created_at),
    INDEX idx_user (user_id)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS voice_clone_references (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    audio_path VARCHAR(512) NOT NULL,
    label VARCHAR(100) DEFAULT NULL,
    duration_seconds FLOAT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB;
