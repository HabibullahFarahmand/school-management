// routes/api.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const router = express.Router();

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
function requireAdminOrTeacher(req, res, next) {
  if (!req.session.user || !['admin','teacher'].includes(req.session.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ============ DASHBOARD ============
router.get('/dashboard/stats', requireAuth, (req, res) => {
  const db = getDb();
  const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  const totalTeachers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role='teacher'").get().count;
  const totalClasses = db.prepare('SELECT COUNT(*) as count FROM classes').get().count;
  const totalSubjects = db.prepare('SELECT COUNT(*) as count FROM subjects').get().count;

  const today = new Date().toISOString().split('T')[0];
  const presentToday = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date=? AND status='present'").get(today).count;
  const absentToday = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date=? AND status='absent'").get(today).count;

  const pendingFees = db.prepare("SELECT COUNT(*) as count FROM fees WHERE status='pending'").get().count;
  const paidFees = db.prepare("SELECT COUNT(*) as count FROM fees WHERE status='paid'").get().count;

  const recentAnnouncements = db.prepare('SELECT a.*, u.name as author_name FROM announcements a JOIN users u ON a.author_id=u.id ORDER BY a.created_at DESC LIMIT 5').all();

  res.json({ totalStudents, totalTeachers, totalClasses, totalSubjects, presentToday, absentToday, pendingFees, paidFees, recentAnnouncements });
});

// ============ STUDENTS ============
router.get('/students', requireAuth, (req, res) => {
  const db = getDb();
  const search = req.query.search || '';
  const classId = req.query.class_id || '';
  let query = `SELECT s.*, u.name, u.username, u.email, c.name as class_name, c.grade
               FROM students s JOIN users u ON s.user_id=u.id LEFT JOIN classes c ON s.class_id=c.id
               WHERE (u.name LIKE ? OR s.roll_number LIKE ?)`;
  const params = [`%${search}%`, `%${search}%`];
  if (classId) { query += ' AND s.class_id = ?'; params.push(classId); }
  query += ' ORDER BY s.roll_number';
  res.json(db.prepare(query).all(...params));
});

router.get('/students/:id', requireAuth, (req, res) => {
  const db = getDb();
  const student = db.prepare(`SELECT s.*, u.name, u.username, u.email, c.name as class_name, c.grade
    FROM students s JOIN users u ON s.user_id=u.id LEFT JOIN classes c ON s.class_id=c.id
    WHERE s.id=?`).get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found' });
  res.json(student);
});

router.post('/students', requireAdmin, (req, res) => {
  const db = getDb();
  const { name, username, email, password, roll_number, class_id, parent_name, parent_phone, address, date_of_birth, gender } = req.body;
  if (!name || !username || !password || !roll_number) return res.status(400).json({ error: 'Required fields missing' });
  const hashedPw = bcrypt.hashSync(password, 10);
  try {
    const user = db.prepare(`INSERT INTO users (username,password,role,name,email) VALUES (?,?,'student',?,?)`).run(username, hashedPw, name, email);
    db.prepare(`INSERT INTO students (user_id,roll_number,class_id,parent_name,parent_phone,address,date_of_birth,gender) VALUES (?,?,?,?,?,?,?,?)`)
      .run(user.lastInsertRowid, roll_number, class_id || null, parent_name, parent_phone, address, date_of_birth, gender);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/students/:id', requireAdminOrTeacher, (req, res) => {
  const db = getDb();
  const { name, email, class_id, parent_name, parent_phone, address, date_of_birth, gender } = req.body;
  const student = db.prepare('SELECT * FROM students WHERE id=?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE users SET name=?, email=? WHERE id=?').run(name, email, student.user_id);
  db.prepare('UPDATE students SET class_id=?,parent_name=?,parent_phone=?,address=?,date_of_birth=?,gender=? WHERE id=?')
    .run(class_id || null, parent_name, parent_phone, address, date_of_birth, gender, req.params.id);
  res.json({ success: true });
});

router.delete('/students/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const student = db.prepare('SELECT * FROM students WHERE id=?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM attendance WHERE student_id=?').run(req.params.id);
  db.prepare('DELETE FROM grades WHERE student_id=?').run(req.params.id);
  db.prepare('DELETE FROM fees WHERE student_id=?').run(req.params.id);
  db.prepare('DELETE FROM students WHERE id=?').run(req.params.id);
  db.prepare('DELETE FROM users WHERE id=?').run(student.user_id);
  res.json({ success: true });
});

// ============ TEACHERS ============
router.get('/teachers', requireAuth, (req, res) => {
  const db = getDb();
  const teachers = db.prepare("SELECT u.*, GROUP_CONCAT(c.name, ', ') as classes FROM users u LEFT JOIN classes c ON c.teacher_id=u.id WHERE u.role='teacher' GROUP BY u.id ORDER BY u.name").all();
  res.json(teachers);
});

router.post('/teachers', requireAdmin, (req, res) => {
  const db = getDb();
  const { name, username, email, password } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'Required fields missing' });
  const hashedPw = bcrypt.hashSync(password, 10);
  try {
    db.prepare(`INSERT INTO users (username,password,role,name,email) VALUES (?,?,'teacher',?,?)`).run(username, hashedPw, name, email);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/teachers/:id', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare("UPDATE classes SET teacher_id=NULL WHERE teacher_id=?").run(req.params.id);
  db.prepare("DELETE FROM users WHERE id=? AND role='teacher'").run(req.params.id);
  res.json({ success: true });
});

// ============ CLASSES ============
router.get('/classes', requireAuth, (req, res) => {
  const db = getDb();
  const classes = db.prepare(`SELECT c.*, u.name as teacher_name, COUNT(s.id) as student_count
    FROM classes c LEFT JOIN users u ON c.teacher_id=u.id LEFT JOIN students s ON s.class_id=c.id
    GROUP BY c.id ORDER BY c.grade, c.section`).all();
  res.json(classes);
});

router.post('/classes', requireAdmin, (req, res) => {
  const db = getDb();
  const { name, grade, section, teacher_id, capacity } = req.body;
  if (!name || !grade) return res.status(400).json({ error: 'Required fields missing' });
  try {
    db.prepare('INSERT INTO classes (name,grade,section,teacher_id,capacity) VALUES (?,?,?,?,?)').run(name, grade, section, teacher_id || null, capacity || 30);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/classes/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const { name, grade, section, teacher_id, capacity } = req.body;
  db.prepare('UPDATE classes SET name=?,grade=?,section=?,teacher_id=?,capacity=? WHERE id=?').run(name, grade, section, teacher_id || null, capacity, req.params.id);
  res.json({ success: true });
});

router.delete('/classes/:id', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM classes WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ============ SUBJECTS ============
router.get('/subjects', requireAuth, (req, res) => {
  const db = getDb();
  const classId = req.query.class_id;
  let query = `SELECT s.*, c.name as class_name, u.name as teacher_name FROM subjects s LEFT JOIN classes c ON s.class_id=c.id LEFT JOIN users u ON s.teacher_id=u.id`;
  const params = [];
  if (classId) { query += ' WHERE s.class_id=?'; params.push(classId); }
  res.json(db.prepare(query).all(...params));
});

router.post('/subjects', requireAdmin, (req, res) => {
  const db = getDb();
  const { name, code, class_id, teacher_id } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Required fields missing' });
  try {
    db.prepare('INSERT INTO subjects (name,code,class_id,teacher_id) VALUES (?,?,?,?)').run(name, code, class_id || null, teacher_id || null);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/subjects/:id', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM subjects WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ============ ATTENDANCE ============
router.get('/attendance', requireAuth, (req, res) => {
  const db = getDb();
  const { class_id, date } = req.query;
  if (!class_id || !date) return res.status(400).json({ error: 'class_id and date required' });
  const records = db.prepare(`SELECT a.*, s.roll_number, u.name as student_name, s.id as student_id
    FROM students s JOIN users u ON s.user_id=u.id LEFT JOIN attendance a ON a.student_id=s.id AND a.date=? AND a.class_id=?
    WHERE s.class_id=? ORDER BY s.roll_number`).all(date, class_id, class_id);
  res.json(records);
});

router.post('/attendance', requireAdminOrTeacher, (req, res) => {
  const db = getDb();
  const { records } = req.body; // [{student_id, class_id, date, status}]
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records array required' });
  const upsert = db.prepare(`INSERT INTO attendance (student_id,class_id,date,status) VALUES (?,?,?,?) ON CONFLICT(student_id,date,class_id) DO UPDATE SET status=excluded.status`);
  const insertMany = db.transaction((recs) => { for (const r of recs) upsert.run(r.student_id, r.class_id, r.date, r.status); });
  insertMany(records);
  res.json({ success: true });
});

router.get('/attendance/report', requireAuth, (req, res) => {
  const db = getDb();
  const { student_id, from, to } = req.query;
  let query = `SELECT a.*, u.name as student_name, c.name as class_name
    FROM attendance a JOIN students s ON a.student_id=s.id JOIN users u ON s.user_id=u.id JOIN classes c ON a.class_id=c.id WHERE 1=1`;
  const params = [];
  if (student_id) { query += ' AND a.student_id=?'; params.push(student_id); }
  if (from) { query += ' AND a.date>=?'; params.push(from); }
  if (to) { query += ' AND a.date<=?'; params.push(to); }
  query += ' ORDER BY a.date DESC LIMIT 200';
  res.json(db.prepare(query).all(...params));
});

// ============ GRADES ============
router.get('/grades', requireAuth, (req, res) => {
  const db = getDb();
  const { student_id, subject_id } = req.query;
  let query = `SELECT g.*, u.name as student_name, s.name as subject_name, s.code as subject_code
    FROM grades g JOIN students st ON g.student_id=st.id JOIN users u ON st.user_id=u.id JOIN subjects s ON g.subject_id=s.id WHERE 1=1`;
  const params = [];
  if (student_id) { query += ' AND g.student_id=?'; params.push(student_id); }
  if (subject_id) { query += ' AND g.subject_id=?'; params.push(subject_id); }
  res.json(db.prepare(query + ' ORDER BY g.date DESC').all(...params));
});

router.post('/grades', requireAdminOrTeacher, (req, res) => {
  const db = getDb();
  const { student_id, subject_id, exam_type, marks_obtained, total_marks, grade_letter, remarks } = req.body;
  if (!student_id || !subject_id || !exam_type) return res.status(400).json({ error: 'Required fields missing' });
  db.prepare('INSERT INTO grades (student_id,subject_id,exam_type,marks_obtained,total_marks,grade_letter,remarks) VALUES (?,?,?,?,?,?,?)')
    .run(student_id, subject_id, exam_type, marks_obtained, total_marks || 100, grade_letter, remarks);
  res.json({ success: true });
});

router.delete('/grades/:id', requireAdminOrTeacher, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM grades WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ============ FEES ============
router.get('/fees', requireAuth, (req, res) => {
  const db = getDb();
  const { student_id, status } = req.query;
  let query = `SELECT f.*, u.name as student_name, s.roll_number FROM fees f JOIN students s ON f.student_id=s.id JOIN users u ON s.user_id=u.id WHERE 1=1`;
  const params = [];
  if (student_id) { query += ' AND f.student_id=?'; params.push(student_id); }
  if (status) { query += ' AND f.status=?'; params.push(status); }
  res.json(db.prepare(query + ' ORDER BY f.due_date DESC').all(...params));
});

router.post('/fees', requireAdmin, (req, res) => {
  const db = getDb();
  const { student_id, fee_type, amount, due_date } = req.body;
  if (!student_id || !fee_type || !amount) return res.status(400).json({ error: 'Required fields missing' });
  db.prepare('INSERT INTO fees (student_id,fee_type,amount,due_date,status) VALUES (?,?,?,?,\'pending\')').run(student_id, fee_type, amount, due_date);
  res.json({ success: true });
});

router.put('/fees/:id/pay', requireAdmin, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  db.prepare("UPDATE fees SET status='paid', paid_date=? WHERE id=?").run(today, req.params.id);
  res.json({ success: true });
});

router.delete('/fees/:id', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM fees WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ============ ANNOUNCEMENTS ============
router.get('/announcements', requireAuth, (req, res) => {
  const db = getDb();
  const role = req.session.user.role;
  const announcements = db.prepare(`SELECT a.*, u.name as author_name FROM announcements a JOIN users u ON a.author_id=u.id
    WHERE a.target_role='all' OR a.target_role=? ORDER BY a.created_at DESC LIMIT 20`).all(role);
  res.json(announcements);
});

router.post('/announcements', requireAdminOrTeacher, (req, res) => {
  const db = getDb();
  const { title, content, target_role } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Required fields missing' });
  db.prepare('INSERT INTO announcements (title,content,author_id,target_role) VALUES (?,?,?,?)').run(title, content, req.session.user.id, target_role || 'all');
  res.json({ success: true });
});

router.delete('/announcements/:id', requireAdminOrTeacher, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM announcements WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ============ TIMETABLE ============
router.get('/timetable', requireAuth, (req, res) => {
  const db = getDb();
  const { class_id } = req.query;
  let query = `SELECT t.*, s.name as subject_name, s.code, c.name as class_name, u.name as teacher_name
    FROM timetable t JOIN subjects s ON t.subject_id=s.id JOIN classes c ON t.class_id=c.id JOIN users u ON s.teacher_id=u.id WHERE 1=1`;
  const params = [];
  if (class_id) { query += ' AND t.class_id=?'; params.push(class_id); }
  res.json(db.prepare(query + ' ORDER BY CASE t.day_of_week WHEN "Monday" THEN 1 WHEN "Tuesday" THEN 2 WHEN "Wednesday" THEN 3 WHEN "Thursday" THEN 4 WHEN "Friday" THEN 5 ELSE 6 END, t.start_time').all(...params));
});

router.post('/timetable', requireAdmin, (req, res) => {
  const db = getDb();
  const { class_id, subject_id, day_of_week, start_time, end_time } = req.body;
  db.prepare('INSERT INTO timetable (class_id,subject_id,day_of_week,start_time,end_time) VALUES (?,?,?,?,?)').run(class_id, subject_id, day_of_week, start_time, end_time);
  res.json({ success: true });
});

router.delete('/timetable/:id', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM timetable WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
