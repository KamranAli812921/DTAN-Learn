// Central import so every schema is registered with Mongoose before any
// .populate() call runs — avoids "MissingSchemaError" on cold starts where
// only one model file was imported directly.
import User from "./User";
import Student from "./Student";
import Teacher from "./Teacher";
import Course from "./Course";
import Batch from "./Batch";
import Enrollment from "./Enrollment";
import LiveClass from "./LiveClass";
import Attendance from "./Attendance";
import AttendanceAuditLog from "./AttendanceAuditLog";
import PasswordResetToken from "./PasswordResetToken";
import RateLimitEvent from "./RateLimitEvent";
import Assignment from "./Assignment";
import Submission from "./Submission";
import Mark from "./Mark";
import Material from "./Material";
import Announcement from "./Announcement";

export {
  User,
  Student,
  Teacher,
  Course,
  Batch,
  Enrollment,
  LiveClass,
  Attendance,
  AttendanceAuditLog,
  PasswordResetToken,
  RateLimitEvent,
  Assignment,
  Submission,
  Mark,
  Material,
  Announcement,
};
