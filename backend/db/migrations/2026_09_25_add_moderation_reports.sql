DROP TABLE IF EXISTS moderation_reports;

CREATE TABLE moderation_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content_type ENUM('question', 'answer') NOT NULL,
    content_id INT NOT NULL,
    user_id INT NULL,
    category ENUM(
        'politica',
        'hate',
        'threat',
        'harassment',
        'other'
    ) NOT NULL,
    severity ENUM(
        'low',
        'medium',
        'high'
    ) NOT NULL DEFAULT 'low',
    status ENUM(
        'pending',
        'reviewed',
        'dismissed',
        'action_taken'
    ) NOT NULL DEFAULT 'pending',
    action ENUM(
        'none',
        'hide',
        'remove'
    ) NOT NULL DEFAULT 'none',
    reason TEXT,
    ai_result JSON NULL,
    review_note TEXT NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_moderation_content (content_type, content_id),
    INDEX idx_moderation_status (status),
    INDEX idx_moderation_category (category),
    INDEX idx_moderation_created_at (created_at),
    INDEX idx_moderation_user (user_id),

    CONSTRAINT fk_moderation_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_moderation_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;




-- CREATE TABLE IF NOT EXISTS moderation_reports (
--     id INT AUTO_INCREMENT PRIMARY KEY,

--     content_type ENUM('question', 'answer') NOT NULL,

--     content_id INT NOT NULL,

--     category ENUM(
--         'political',
--         'hate',
--         'threat',
--         'harassment',
--         'other'
--     ) NOT NULL,

--     severity ENUM(
--         'low',
--         'medium',
--         'high'
--     ) NOT NULL DEFAULT 'low',

--     status ENUM(
--         'pending',
--         'reviewed',
--         'dismissed',
--         'action_taken'
--     ) NOT NULL DEFAULT 'pending',

--     action ENUM(
--         'none',
--         'hide',
--         'remove'
--     ) NOT NULL DEFAULT 'none',

--     reason TEXT,

--     ai_result JSON NULL,

--     review_note TEXT NULL,

--     reviewed_by INT NULL,

--     reviewed_at TIMESTAMP NULL,

--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
--         ON UPDATE CURRENT_TIMESTAMP,

--     INDEX idx_moderation_content (content_type, content_id),
--     INDEX idx_moderation_status (status),
--     INDEX idx_moderation_category (category),
--     INDEX idx_moderation_created_at (created_at),

--     CONSTRAINT fk_moderation_reviewer
--         FOREIGN KEY (reviewed_by)
--         REFERENCES users(user_id)
--         ON DELETE SET NULL
-- ) ENGINE=InnoDB;