import dotenv from "dotenv";
dotenv.config();
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const email = (process.env.OWNER_EMAIL || "tsede@gmail.com")
  .trim()
  .toLowerCase();
const password = process.env.OWNER_PASSWORD || "Tsedesedo@123";
const firstName = process.env.OWNER_FIRST_NAME || "Site";
const lastName = process.env.OWNER_LAST_NAME || "Owner";

// Strict password security check
const isStrongPassword = (value) =>
  value.length >= 8 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /[0-9]/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

// Require credentials in .env file
if (!email || !password) {
  console.error(
    "❌ OWNER_EMAIL and OWNER_PASSWORD are required in your .env file.",
  );
  process.exit(1);
}

// Validate password strength
if (!isStrongPassword(password)) {
  console.error(
    "❌ OWNER_PASSWORD must be at least 8 characters and include uppercase, lowercase, number, and special character.",
  );
  process.exit(1);
}

async function seedOwner() {
  // 1. Create connection using your .env variables
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  try {
    console.log("Connected to database: %s", process.env.DB_NAME);

    // 2. Find the requested owner account by email
    const [existingTarget] = await connection.execute(
      "SELECT user_id, role FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    // 3. Find active owners to prevent multiple system owners
    const [activeOwners] = await connection.execute(
      "SELECT user_id, email FROM users WHERE role = 'owner' AND is_active = 1 LIMIT 2",
    );

    // Never allow multiple active owners
    if (activeOwners.length > 1) {
      console.error(
        "❌ More than one active owner exists. Resolve duplicate owners manually before running seed.",
      );
      process.exitCode = 1;
      return;
    }

    // If an active owner already exists with a different email, refuse to create another
    if (activeOwners.length === 1) {
      const currentOwner = activeOwners[0];

      if (
        existingTarget.length === 0 ||
        existingTarget[0].user_id !== currentOwner.user_id
      ) {
        console.error(
          `❌ An active owner already exists (${currentOwner.email}). Refusing to create a second owner.`,
        );
        process.exitCode = 1;
        return;
      }

      // Refresh existing owner details, update timestamp, and invalidate old tokens
      const passwordHash = await bcrypt.hash(password, 10);
      await connection.execute(
        `UPDATE users
         SET first_name = ?, last_name = ?, password_hash = ?, is_active = 1, token_version = token_version + 1, updated_at = NOW()
         WHERE user_id = ?`,
        [firstName, lastName, passwordHash, currentOwner.user_id],
      );

      console.log(
        `✔ Owner account ID ${currentOwner.user_id} is updated and ready.`,
      );
      return;
    }

    // 4. No active owner exists yet. Create one if email is not taken.
    if (existingTarget.length === 0) {
      const passwordHash = await bcrypt.hash(password, 10);
      const [result] = await connection.execute(
        `INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, token_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'owner', 1, 0, NOW(), NOW())`,
        [firstName, lastName, email, passwordHash],
      );

      console.log(`✔ Owner created successfully! user_id = ${result.insertId}`);
      return;
    }

    // 5. Promote existing account to owner if no active owner exists
    const passwordHash = await bcrypt.hash(password, 10);
    await connection.execute(
      `UPDATE users
       SET first_name = ?, last_name = ?, password_hash = ?, role = 'owner', is_active = 1, token_version = token_version + 1, updated_at = NOW()
       WHERE user_id = ?`,
      [firstName, lastName, passwordHash, existingTarget[0].user_id],
    );

    console.log(
      `✔ Existing account ID ${existingTarget[0].user_id} promoted to owner.`,
    );
  } catch (error) {
    console.error("❌ Error seeding owner:", error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

seedOwner();
