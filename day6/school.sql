-- =====================================================
-- School database: students, courses and enrolments
-- Written for SQLite (works in sqliteonline.com)
-- =====================================================

-- SQLite only enforces foreign keys after this line
PRAGMA foreign_keys = ON;

-- Remove old copies so the whole file can be run again (children first)
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- =====================================================
-- 1. CREATE TABLE statements
-- =====================================================

CREATE TABLE students (
  id          INTEGER PRIMARY KEY,            -- unique id for each student
  name        TEXT NOT NULL,                  -- must have a value
  email       TEXT NOT NULL UNIQUE,           -- no two students share an email
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP  -- filled in automatically
);

CREATE TABLE courses (
  id          INTEGER PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,           -- e.g. WEB101
  title       TEXT NOT NULL
);

-- Join table: one row = one student enrolled on one course
CREATE TABLE enrolments (
  student_id   INTEGER NOT NULL,
  course_id    INTEGER NOT NULL,
  grade        INTEGER CHECK (grade >= 0 AND grade <= 100),  -- empty until graded
  enrolled_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, course_id),        -- the same pair cannot appear twice
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE
);

-- Index for searches by course (see school-design.md for the reason)
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);

-- =====================================================
-- 2. INSERT sample data
-- =====================================================

INSERT INTO students (id, name, email) VALUES (1, 'Amina Otieno',  'amina@example.com');
INSERT INTO students (id, name, email) VALUES (2, 'Brian Kamau',   'brian@example.com');
INSERT INTO students (id, name, email) VALUES (3, 'Grace Wanjiku', 'grace@example.com');
INSERT INTO students (id, name, email) VALUES (4, 'Daniel Mwangi', 'daniel@example.com');

INSERT INTO courses (id, code, title) VALUES (1, 'WEB101', 'Web Development');
INSERT INTO courses (id, code, title) VALUES (2, 'DB101',  'Databases');
INSERT INTO courses (id, code, title) VALUES (3, 'MTH101', 'Mathematics');

INSERT INTO enrolments (student_id, course_id, grade) VALUES (1, 1, 85);
INSERT INTO enrolments (student_id, course_id, grade) VALUES (1, 2, 78);
INSERT INTO enrolments (student_id, course_id, grade) VALUES (2, 1, 67);
INSERT INTO enrolments (student_id, course_id, grade) VALUES (2, 3, 74);
INSERT INTO enrolments (student_id, course_id, grade) VALUES (3, 1, 92);
INSERT INTO enrolments (student_id, course_id)        VALUES (3, 3);   -- not graded yet

-- Duplicate enrolment test (leave commented out: it should FAIL with a
-- "UNIQUE constraint failed" error, which proves the rule works)
-- INSERT INTO enrolments (student_id, course_id, grade) VALUES (1, 1, 90);

-- =====================================================
-- 3. The five queries
-- =====================================================

-- Query 1: all courses for one student (by name)
SELECT courses.code, courses.title, enrolments.grade
FROM students
JOIN enrolments ON enrolments.student_id = students.id
JOIN courses    ON courses.id = enrolments.course_id
WHERE students.name = 'Amina Otieno'
ORDER BY courses.title;
-- Expected: DB101 | Databases | 78
--           WEB101 | Web Development | 85

-- Query 2: all students on one course
SELECT students.name, students.email
FROM courses
JOIN enrolments ON enrolments.course_id = courses.id
JOIN students   ON students.id = enrolments.student_id
WHERE courses.title = 'Web Development'
ORDER BY students.name;
-- Expected: Amina Otieno | amina@example.com
--           Brian Kamau | brian@example.com
--           Grace Wanjiku | grace@example.com

-- Query 3: number of students per course
-- (LEFT JOIN keeps courses even if nobody is enrolled)
SELECT courses.title, COUNT(enrolments.student_id) AS student_count
FROM courses
LEFT JOIN enrolments ON enrolments.course_id = courses.id
GROUP BY courses.id;
-- Expected: Web Development | 3
--           Databases | 1
--           Mathematics | 2

-- Query 4: students who have no enrolments
-- (LEFT JOIN keeps every student; unmatched ones have NULL in the enrolments columns)
SELECT students.name
FROM students
LEFT JOIN enrolments ON enrolments.student_id = students.id
WHERE enrolments.student_id IS NULL;
-- Expected: Daniel Mwangi

-- Query 5: update one enrolment's grade (always use WHERE!)
UPDATE enrolments
SET grade = 75
WHERE student_id = 2 AND course_id = 1;

-- Check the change: Brian's Web Development grade should now be 75
SELECT students.name, courses.title, enrolments.grade
FROM enrolments
JOIN students ON students.id = enrolments.student_id
JOIN courses  ON courses.id = enrolments.course_id
WHERE enrolments.student_id = 2 AND enrolments.course_id = 1;
-- Expected: Brian Kamau | Web Development | 75
