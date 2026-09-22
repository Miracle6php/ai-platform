ALTER TABLE voice_clone_references
    ADD COLUMN elevenlabs_voice_id VARCHAR(64) DEFAULT NULL AFTER audio_path;
