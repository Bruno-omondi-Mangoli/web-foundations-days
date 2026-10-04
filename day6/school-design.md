# School Database Design

This database stores the students of a school, the courses they can take, and which student is enrolled on which course (with a grade). It has three entities: a student, a course, and the fact that a student is enrolled on a course.

## Tables

### students

- Holds one row per student.
- `id` is the primary key, `name` must have a value, and `email` must have a value and be **UNIQUE**, so two students can never share an email.
- `created_at` is filled in automatically.

### courses

- Holds one row per course.
- `id` is the primary key, `code` (such as WEB101) is unique, and `title` must have a value.

### enrolments

- Holds one row per student-on-course. It links the other two tables and stores the grade.
- `student_id` is a foreign key pointing to `students(id)`, and `course_id` is a foreign key pointing to `courses(id)`. Both are NOT NULL.
- `grade` is a whole number from 0 to 100 (enforced with `CHECK`). It is empty until the student is graded.
- The primary key is the pair `(student_id, course_id)`, so the same student cannot enrol on the same course twice.
- Both foreign keys use `ON DELETE CASCADE`, so deleting a student or a course also removes their enrolments.

## Relationships

- **One-to-many:** one student has many enrolments, and one course has many enrolments. Each enrolment row belongs to exactly one student and one course, which is why `enrolments` holds a foreign key to each.
- **Many-to-many:** students and courses. A student can take many courses, and a course has many students.
- **Why a join table is needed:** a many-to-many relationship cannot be stored with a single foreign key, and storing a list such as `courses = "WEB101,DB101"` in one column is hard to search and update. The `enrolments` table stores one pair of ids per row instead. It is also the natural place for the grade, because a grade belongs to the pair (this student on this course), not to the student or the course alone.

## Index

I would add an index on `enrolments(course_id)`:

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);
```

- **Reason:** the queries "all students on one course" and "number of students per course" search by `course_id`. Without an index the database checks every enrolment row; with it, the database jumps straight to the rows for that course.
- **Trade-off:** indexes make reads faster but make writes slightly slower and use extra storage. That is acceptable here because enrolments are read far more often than they are created.

## SQL or NoSQL?

I would choose SQL (for example SQLite, PostgreSQL or MySQL) for this system. The data is clearly structured, with students, courses and enrolments that have clear relationships, including a many-to-many one that SQL handles well with a join table and JOINs. The rules matter too: unique emails, no duplicate enrolments and grades between 0 and 100 can be enforced by the database itself, which is important when the data is as sensitive as student grades and correctness is critical. A document database would store enrolments inside student or course documents, so the same facts would be duplicated and the application code would have to enforce the rules. I would only reconsider NoSQL if the data became very flexible in shape or had to grow to a very large scale.
