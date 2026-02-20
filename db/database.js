// db/database.js
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../school.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
      name TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade TEXT NOT NULL,
      section TEXT,
      teacher_id INTEGER,
      capacity INTEGER DEFAULT 30,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      roll_number TEXT UNIQUE NOT NULL,
      class_id INTEGER,
      parent_name TEXT,
      parent_phone TEXT,
      address TEXT,
      date_of_birth TEXT,
      gender TEXT,
      admission_date TEXT DEFAULT CURRENT_DATE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      class_id INTEGER,
      teacher_id INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present','absent','late')),
      UNIQUE(student_id, date, class_id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      exam_type TEXT NOT NULL,
      marks_obtained REAL,
      total_marks REAL DEFAULT 100,
      grade_letter TEXT,
      remarks TEXT,
      date TEXT DEFAULT CURRENT_DATE,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    );

    CREATE TABLE IF NOT EXISTS fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      fee_type TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT,
      paid_date TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','overdue')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      target_role TEXT DEFAULT 'all',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS timetable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    );
  `);

  // Seed admin user if none exists
  const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (username, password, role, name, email)
      VALUES (?, ?, 'admin', 'System Administrator', 'admin@school.edu')
    `).run('admin', hashedPassword);

    // Seed some demo data
    seedDemoData(db);
  }

  console.log('✅ Database initialized successfully');
}

function seedDemoData(db) {
  // Teachers
  const t1pass = bcrypt.hashSync('teacher123', 10);
  const t1 = db.prepare(`INSERT INTO users (username,password,role,name,email) VALUES (?,?,'teacher',?,?)`).run('smith', t1pass, 'John Smith', 'smith@school.edu');
  const t2 = db.prepare(`INSERT INTO users (username,password,role,name,email) VALUES (?,?,'teacher',?,?)`).run('johnson', t1pass, 'Mary Johnson', 'johnson@school.edu');

  // Classes
  const c1 = db.prepare(`INSERT INTO classes (name,grade,section,teacher_id,capacity) VALUES (?,?,?,?,?)`).run('Class 10-A', '10', 'A', t1.lastInsertRowid, 35);
  const c2 = db.prepare(`INSERT INTO classes (name,grade,section,teacher_id,capacity) VALUES (?,?,?,?,?)`).run('Class 9-B', '9', 'B', t2.lastInsertRowid, 32);

  // Subjects
  const s1 = db.prepare(`INSERT INTO subjects (name,code,class_id,teacher_id) VALUES (?,?,?,?)`).run('Mathematics', 'MATH10', c1.lastInsertRowid, t1.lastInsertRowid);
  const s2 = db.prepare(`INSERT INTO subjects (name,code,class_id,teacher_id) VALUES (?,?,?,?)`).run('English', 'ENG10', c1.lastInsertRowid, t2.lastInsertRowid);
  const s3 = db.prepare(`INSERT INTO subjects (name,code,class_id,teacher_id) VALUES (?,?,?,?)`).run('Science', 'SCI9', c2.lastInsertRowid, t1.lastInsertRowid);

  // Students
  const spass = bcrypt.hashSync('student123', 10);
  const studentData = [
    ['alice', 'Alice Brown', 'alice@school.edu', 'S001', c1.lastInsertRowid, 'Female'],
    ['bob', 'Bob Davis', 'bob@school.edu', 'S002', c1.lastInsertRowid, 'Male'],
    ['carol', 'Carol Evans', 'carol@school.edu', 'S003', c2.lastInsertRowid, 'Female'],
    ['dave', 'Dave Foster', 'dave@school.edu', 'S004', c2.lastInsertRowid, 'Male'],
  ];

  for (const [uname, name, email, roll, classId, gender] of studentData) {
    const user = db.prepare(`INSERT INTO users (username,password,role,name,email) VALUES (?,?,'student',?,?)`).run(uname, spass, name, email);
    db.prepare(`INSERT INTO students (user_id,roll_number,class_id,gender,date_of_birth,parent_name) VALUES (?,?,?,?,?,?)`).run(user.lastInsertRowid, roll, classId, gender, '2008-05-15', 'Parent Name');
  }

  // Announcements
  db.prepare(`INSERT INTO announcements (title,content,author_id,target_role) VALUES (?,?,?,?)`).run(
    'Welcome Back!', 'Welcome to the new academic year 2024-25. Wishing everyone a great year ahead!', 1, 'all'
  );
  db.prepare(`INSERT INTO announcements (title,content,author_id,target_role) VALUES (?,?,?,?)`).run(
    'Mid-Term Exams Schedule', 'Mid-term examinations will commence from next Monday. Please check the timetable.', 1, 'all'
  );

  console.log('✅ Demo data seeded. Login: admin/admin123, teacher: smith/teacher123, student: alice/student123');
}

module.exports = { getDb, initDb };
