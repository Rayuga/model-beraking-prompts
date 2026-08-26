import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'medcare.db'));
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor')),
    date_of_birth TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS doctors (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    specialty TEXT NOT NULL,
    consultation_fee INTEGER NOT NULL CHECK (consultation_fee > 0),
    bio TEXT NOT NULL,
    years_experience INTEGER NOT NULL,
    availability TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS patients (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT,
    address TEXT
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    doctor_id TEXT NOT NULL REFERENCES doctors(user_id) ON DELETE CASCADE,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed'
      CHECK (status IN ('confirmed', 'completed', 'cancelled')),
    payment_amount INTEGER NOT NULL CHECK (payment_amount > 0),
    stripe_session_id TEXT UNIQUE,
    stripe_payment_intent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS medical_records (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    doctor_id TEXT NOT NULL REFERENCES doctors(user_id) ON DELETE CASCADE,
    chief_complaint TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    treatment_notes TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments(patient_id);
  CREATE INDEX IF NOT EXISTS appointments_doctor_idx ON appointments(doctor_id);
  CREATE INDEX IF NOT EXISTS records_patient_idx ON medical_records(patient_id);
  CREATE INDEX IF NOT EXISTS records_doctor_idx ON medical_records(doctor_id);
`);

function ensureActiveSlotUniqueness() {
  const ddl = db.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'appointments'
  `).get()?.sql || '';

  // Older builds inlined UNIQUE (doctor_id, date, time), which blocked rebooking
  // after cancellation. Recreate the table without that constraint.
  if (/UNIQUE\s*\(\s*doctor_id\s*,\s*appointment_date\s*,\s*appointment_time\s*\)/i.test(ddl)) {
    db.exec('BEGIN');
    try {
      db.exec(`
        CREATE TABLE appointments__slot_migration (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
          doctor_id TEXT NOT NULL REFERENCES doctors(user_id) ON DELETE CASCADE,
          appointment_date TEXT NOT NULL,
          appointment_time TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'confirmed'
            CHECK (status IN ('confirmed', 'completed', 'cancelled')),
          payment_amount INTEGER NOT NULL CHECK (payment_amount > 0),
          stripe_session_id TEXT UNIQUE,
          stripe_payment_intent TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO appointments__slot_migration SELECT * FROM appointments;
        DROP TABLE appointments;
        ALTER TABLE appointments__slot_migration RENAME TO appointments;
        CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments(patient_id);
        CREATE INDEX IF NOT EXISTS appointments_doctor_idx ON appointments(doctor_id);
      `);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_slot_idx
      ON appointments (doctor_id, appointment_date, appointment_time)
      WHERE status != 'cancelled'
  `);
}

ensureActiveSlotUniqueness();

// Stable IDs and details match assets/artifacts/*.json (fees: consultation_fee_usd × 100 → cents).
const users = [
  ['11111111-1111-1111-1111-111111111111', 'sarah.chen@medcare.com', 'Dr. Sarah Chen', 'doctor', '1980-03-15'],
  ['22222222-2222-2222-2222-222222222222', 'james.mitchell@medcare.com', 'Dr. James Mitchell', 'doctor', '1975-07-22'],
  ['33333333-3333-3333-3333-333333333333', 'priya.sharma@medcare.com', 'Dr. Priya Sharma', 'doctor', '1985-11-08'],
  ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice.j@patient.com', 'Alice Johnson', 'patient', '1990-05-15'],
  ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob.w@patient.com', 'Bob Williams', 'patient', '1985-08-22'],
  ['cccccccc-cccc-cccc-cccc-cccccccccccc', 'carol.davis@patient.com', 'Carol Davis', 'patient', '1992-12-03']
];

const doctors = [
  [
    users[0][0],
    'Cardiology',
    15000,
    'Board-certified cardiologist specializing in preventive cardiology and heart disease management.',
    15,
    'Mon-Fri 9AM-5PM'
  ],
  [
    users[1][0],
    'Dermatology',
    12000,
    'Expert dermatologist specializing in skin conditions, acne treatment, and cosmetic dermatology.',
    12,
    'Mon-Fri 10AM-6PM'
  ],
  [
    users[2][0],
    'Pediatrics',
    10000,
    "Compassionate pediatrician dedicated to children's health and development.",
    8,
    'Mon-Sat 8AM-4PM'
  ]
];

db.exec('BEGIN');
try {
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, email, full_name, role, date_of_birth)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const user of users) insertUser.run(...user);

  const insertDoctor = db.prepare(`
    INSERT OR IGNORE INTO doctors
      (user_id, specialty, consultation_fee, bio, years_experience, availability)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const doctor of doctors) insertDoctor.run(...doctor);

  const insertPatient = db.prepare(`
    INSERT OR IGNORE INTO patients (user_id) VALUES (?)
  `);
  for (const user of users) {
    if (user[3] === 'patient') insertPatient.run(user[0]);
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

export const DEFAULT_PATIENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    date_of_birth: user.date_of_birth
  };
}
