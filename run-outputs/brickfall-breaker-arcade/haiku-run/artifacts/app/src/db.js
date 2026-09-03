const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'brickfall.db');

function getDb() {
  return new sqlite3.Database(DB_PATH);
}

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          initials TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          highest_level INTEGER DEFAULT 1,
          best_score INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tokens table
      db.run(`
        CREATE TABLE IF NOT EXISTS tokens (
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Levels table
      db.run(`
        CREATE TABLE IF NOT EXISTS levels (
          level INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          base_speed INTEGER NOT NULL,
          speed_cap INTEGER NOT NULL,
          accent TEXT NOT NULL
        )
      `);

      // Bricks table
      db.run(`
        CREATE TABLE IF NOT EXISTS bricks (
          id INTEGER PRIMARY KEY,
          level INTEGER NOT NULL,
          row INTEGER NOT NULL,
          column INTEGER NOT NULL,
          type TEXT NOT NULL,
          drop_type TEXT,
          FOREIGN KEY (level) REFERENCES levels(level)
        )
      `);

      // Leaderboard table
      db.run(`
        CREATE TABLE IF NOT EXISTS leaderboard (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          initials TEXT NOT NULL,
          score INTEGER NOT NULL,
          level INTEGER NOT NULL,
          achieved_at DATETIME NOT NULL,
          email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Run snapshots table
      db.run(`
        CREATE TABLE IF NOT EXISTS run_snapshots (
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          run_id TEXT UNIQUE NOT NULL,
          revision INTEGER NOT NULL,
          level INTEGER NOT NULL,
          score INTEGER NOT NULL,
          lives INTEGER NOT NULL,
          combo INTEGER NOT NULL,
          next_extra_life INTEGER NOT NULL,
          power TEXT,
          power_seconds REAL,
          paddle_width INTEGER NOT NULL,
          balls TEXT NOT NULL,
          drops TEXT NOT NULL,
          bricks TEXT NOT NULL,
          simulation_time REAL NOT NULL,
          state TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Run history table (terminal runs)
      db.run(`
        CREATE TABLE IF NOT EXISTS run_history (
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          run_id TEXT NOT NULL,
          outcome TEXT NOT NULL,
          level INTEGER NOT NULL,
          score INTEGER NOT NULL,
          snapshot TEXT NOT NULL,
          finished_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Constants table
      db.run(`
        CREATE TABLE IF NOT EXISTS constants (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      // Request receipts table (for idempotency)
      db.run(`
        CREATE TABLE IF NOT EXISTS request_receipts (
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          operation_id TEXT NOT NULL,
          revision INTEGER NOT NULL,
          status INTEGER NOT NULL,
          response TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, operation_id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Mechanics lab drills table
      db.run(`
        CREATE TABLE IF NOT EXISTS drills (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          initial TEXT NOT NULL,
          after_advance TEXT NOT NULL,
          after_second_advance TEXT
        )
      `);

      // Checkpoint snapshots table
      db.run(`
        CREATE TABLE IF NOT EXISTS checkpoints (
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          revision INTEGER NOT NULL,
          level INTEGER NOT NULL,
          score INTEGER NOT NULL,
          lives INTEGER NOT NULL,
          combo INTEGER NOT NULL,
          next_extra_life INTEGER NOT NULL,
          power TEXT,
          power_seconds REAL,
          paddle_width INTEGER NOT NULL,
          balls TEXT NOT NULL,
          drops TEXT NOT NULL,
          bricks TEXT NOT NULL,
          simulation_time REAL NOT NULL,
          next_outcome TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    db.close();
  });
}

function seedDatabase() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    // Check if already seeded
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
      if (err) {
        db.close();
        reject(err);
        return;
      }

      if (row.count > 0) {
        // Already seeded
        db.close();
        resolve();
        return;
      }

      // Load seed data
      const seedPath = path.join(__dirname, '..', '..', 'assets', 'artifacts', 'brickfall_seed.xlsx');
      const scenariosPath = path.join(__dirname, '..', '..', 'assets', 'artifacts', 'brickfall_scenarios.json');

      try {
        const XLSX = require('xlsx');
        
        // Read Excel file
        const workbook = XLSX.readFile(seedPath);
        
        // Prepare all data
        const usersSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Users']);
        const levelsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Levels']);
        const bricksSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Bricks']);
        const leaderboardSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Leaderboard']);
        const constantsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Constants']);
        const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));

        db.serialize(() => {
          // Seed users
          usersSheet.forEach(user => {
            const salt = crypto.randomBytes(16).toString('hex');
            const hash = crypto.pbkdf2Sync(user.password, salt, 100000, 64, 'sha256').toString('hex');
            db.run(
              `INSERT INTO users (email, name, initials, password_hash, password_salt, highest_level, best_score)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [user.email, user.name, user.initials, hash, salt, user.highest_level, user.best_score]
            );
          });

          // Seed levels
          levelsSheet.forEach(level => {
            db.run(
              `INSERT INTO levels (level, name, base_speed, speed_cap, accent)
               VALUES (?, ?, ?, ?, ?)`,
              [level.level, level.name, level.base_speed, level.speed_cap, level.accent]
            );
          });

          // Seed bricks
          bricksSheet.forEach(brick => {
            db.run(
              `INSERT INTO bricks (level, row, column, type, drop_type)
               VALUES (?, ?, ?, ?, ?)`,
              [brick.level, brick.row, brick.column, brick.type, brick.drop || null]
            );
          });

          // Seed leaderboard
          leaderboardSheet.forEach(entry => {
            db.run(
              `INSERT INTO leaderboard (initials, score, level, achieved_at, email)
               VALUES (?, ?, ?, ?, ?)`,
              [entry.initials, entry.score, entry.level, entry.achieved_at, entry.email || null]
            );
          });

          // Seed constants
          constantsSheet.forEach(constant => {
            db.run(
              `INSERT INTO constants (key, value) VALUES (?, ?)`,
              [constant.key, String(constant.value)]
            );
          });

          // Seed guest leaderboard entries
          scenarios.guest_leaderboard.forEach(entry => {
            db.run(
              `INSERT INTO leaderboard (initials, score, level, achieved_at, email)
               VALUES (?, ?, ?, ?, ?)`,
              [entry.initials, entry.score, entry.level, entry.achieved_at, null]
            );
          });

          // Seed drills
          scenarios.drills.forEach(drill => {
            db.run(
              `INSERT INTO drills (id, name, initial, after_advance, after_second_advance)
               VALUES (?, ?, ?, ?, ?)`,
              [drill.id, drill.name, drill.initial, drill.after_advance, drill.after_second_advance || null]
            );
          });

          // Final callback after all inserts
          db.all("SELECT id, email FROM users WHERE email IN ('mira@brickfall.test', 'dev@brickfall.test')", (err, users) => {
            if (err) {
              db.close();
              reject(err);
              return;
            }

            users.forEach(user => {
              const checkpoint = scenarios.checkpoints[user.email.split('@')[0]];
              if (checkpoint) {
                db.run(
                  `INSERT INTO checkpoints (user_id, revision, level, score, lives, combo, next_extra_life, power, power_seconds, paddle_width, balls, drops, bricks, simulation_time, next_outcome)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [user.id, checkpoint.revision, checkpoint.level, checkpoint.score, checkpoint.lives, checkpoint.combo, checkpoint.next_extra_life, checkpoint.power || null, checkpoint.power_seconds || null, checkpoint.paddle_width || 118, checkpoint.balls || '', checkpoint.drop || '', '', 0, checkpoint.next_outcome || '']
                );
              }
            });

            db.get("SELECT id FROM users WHERE email = 'polly@brickfall.test'", (err, pollyUser) => {
              if (err) {
                db.close();
                reject(err);
                return;
              }

              if (pollyUser) {
                scenarios.personal_run_fixtures.forEach(fixture => {
                  db.run(
                    `INSERT INTO run_history (user_id, run_id, outcome, level, score, snapshot, finished_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [pollyUser.id, fixture.run_id, fixture.outcome, fixture.level, fixture.score, '{}', fixture.finished_at]
                  );
                });
              }

              db.close();
              resolve();
            });
          });
        });
      } catch (err) {
        db.close();
        reject(err);
      }
    });
  });
}

module.exports = {
  getDb,
  initializeDatabase,
  seedDatabase
};
