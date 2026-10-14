import { db } from "./config.js";

/** Additive, repeatable schema updates. These functions never drop tables. */
export async function ensureAdminSchema() {
  await ensureColumn("users", "role", "VARCHAR(20) NOT NULL DEFAULT 'user'");
  await ensureColumn("users", "is_active", "TINYINT(1) NOT NULL DEFAULT 1");
  await ensureColumn("users", "is_banned", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("users", "banned_at", "DATETIME NULL");
  await ensureColumn("users", "banned_by", "INT NULL");
  await ensureColumn("users", "ban_reason", "TEXT NULL");
  await ensureColumn("users", "violation_count", "INT NOT NULL DEFAULT 0");
  await ensureIndex("users", "idx_users_role", "role");
}

export async function ensureModerationSchema() {
  // Moderation services expect these fields when hiding or restoring content.
  await ensureColumn("questions", "is_hidden", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("questions", "hidden_at", "DATETIME NULL");
  await ensureColumn("questions", "hidden_by", "INT NULL");
  await ensureColumn("answers", "is_hidden", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("answers", "hidden_at", "DATETIME NULL");
  await ensureColumn("answers", "hidden_by", "INT NULL");

  await ensureTable(
    "moderation_reports",
    `CREATE TABLE IF NOT EXISTS \`moderation_reports\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`content_type\` ENUM('question','answer') NOT NULL,
      \`content_id\` INT NOT NULL,
      \`user_id\` INT NULL,
      \`category\` ENUM('political','hate','threat','harassment','other') NOT NULL DEFAULT 'other',
      \`severity\` ENUM('low','medium','high') NOT NULL DEFAULT 'low',
      \`status\` ENUM('pending','reviewed','dismissed','action_taken') NOT NULL DEFAULT 'pending',
      \`action\` ENUM('none','hide','remove') NOT NULL DEFAULT 'none',
      \`reason\` TEXT NULL,
      \`ai_result\` JSON NULL,
      \`review_note\` TEXT NULL,
      \`reviewed_by\` INT NULL,
      \`reviewed_at\` TIMESTAMP NULL DEFAULT NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX \`idx_moderation_content\` (\`content_type\`, \`content_id\`),
      INDEX \`idx_moderation_status\` (\`status\`),
      INDEX \`idx_moderation_category\` (\`category\`),
      INDEX \`idx_moderation_created_at\` (\`created_at\`),
      INDEX \`idx_moderation_user\` (\`user_id\`),
      CONSTRAINT \`fk_moderation_reviewer\` FOREIGN KEY (\`reviewed_by\`) REFERENCES \`users\`(\`user_id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_moderation_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`user_id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  // Upgrade older schema variants that used 'politica' while preserving records.
  const [reportTable] = await db.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'moderation_reports'`,
  );
  if (reportTable.length) {
    await db.query(
      "ALTER TABLE moderation_reports MODIFY category ENUM('politica','political','hate','threat','harassment','other') NOT NULL DEFAULT 'other'",
    );
    await db.query(
      "UPDATE moderation_reports SET category = 'political' WHERE category = 'politica'",
    );
    await db.query(
      "ALTER TABLE moderation_reports MODIFY category ENUM('political','hate','threat','harassment','other') NOT NULL DEFAULT 'other'",
    );
  }
}

export async function ensureAnswerVotesSchema() {
  await ensureTable(
    "answer_votes",
    `CREATE TABLE IF NOT EXISTS \`answer_votes\` (
      \`user_id\` INT NOT NULL,
      \`answer_id\` INT NOT NULL,
      \`vote\` TINYINT NOT NULL DEFAULT 1,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`user_id\`, \`answer_id\`),
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`user_id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`answer_id\`) REFERENCES \`answers\`(\`answer_id\`) ON DELETE CASCADE,
      INDEX \`idx_answer_votes_answer_id\` (\`answer_id\`),
      CONSTRAINT \`chk_answer_votes_value\` CHECK (\`vote\` IN (-1, 1))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

export async function ensureAnswerVectorsSchema() {
  await ensureTable(
    "answer_vectors",
    `CREATE TABLE IF NOT EXISTS \`answer_vectors\` (
      \`vector_id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
      \`answer_id\` INT NOT NULL,
      \`source_text\` TEXT NOT NULL,
      \`embedding\` JSON NOT NULL,
      \`status\` VARCHAR(20) DEFAULT 'ready',
      \`ai_grade\` VARCHAR(16) DEFAULT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (\`answer_id\`) REFERENCES \`answers\`(\`answer_id\`) ON DELETE CASCADE,
      UNIQUE KEY \`uniq_answer_vectors_answer_id\` (\`answer_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  await ensureColumn("answer_vectors", "ai_grade", "VARCHAR(16) DEFAULT NULL");
}

export async function ensureNotificationsSchema() {
  await ensureTable(
    "notifications",
    `CREATE TABLE IF NOT EXISTS \`notifications\` (
      \`notification_id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
      \`user_id\` INT NOT NULL,
      \`type\` VARCHAR(32) NOT NULL DEFAULT 'answer_added',
      \`message\` VARCHAR(512) NOT NULL,
      \`question_id\` INT NOT NULL,
      \`question_hash\` CHAR(16) NOT NULL,
      \`is_read\` TINYINT(1) NOT NULL DEFAULT 0,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`user_id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`question_id\`) REFERENCES \`questions\`(\`question_id\`) ON DELETE CASCADE,
      INDEX \`idx_notifications_user_read\` (\`user_id\`, \`is_read\`, \`created_at\`),
      INDEX \`idx_notifications_question\` (\`question_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

async function ensureTable(table, createSql) {
  const [tables] = await db.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  if (tables.length === 0) {
    await db.query(createSql);
    console.log(`[migrate] created table ${table}`);
  }
}

async function ensureColumn(table, column, definition) {
  const [columns] = await db.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (columns.length === 0) {
    // Table/column names are fixed internal constants at call sites.
    await db.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
    );
    console.log(`[migrate] added column ${table}.${column}`);
  }
}

async function ensureIndex(table, indexName, column) {
  const [indexes] = await db.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  if (indexes.length === 0) {
    await db.query(
      `ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (\`${column}\`)`,
    );
    console.log(`[migrate] added index ${table}.${indexName}`);
  }
}
