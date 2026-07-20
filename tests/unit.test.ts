import assert from "assert";
import {
  sanitizeHTML,
  deepSanitizeObject,
  hasSQLInjectionThreat,
  validateEmail,
  validatePhone,
  validateUploadedFile
} from "../server/security.js";
import {
  routeCache,
  invalidateRouteCache
} from "../server/performance.js";

export function runUnitTests() {
  console.log("▶ Running Unit Tests on Security Shield Core Module...");

  // 1. XSS Sanitize Checking
  const dirty = "<script>alert('xss')</script><img src=x onerror=alert(1)> Hello";
  const clean = sanitizeHTML(dirty);
  assert.ok(!clean.includes("<script>"), "Should strip script tags");
  assert.ok(!clean.includes("onerror"), "Should strip event handler on* attributes");
  console.log("  ✔ XSS Sanitizer test passed");

  // Heap-nested object cleaning
  const nested = {
    content: "Normal string",
    payload: "<script>dangerous();</script>",
    author: {
      name: "Ramesh Sharma",
      bio: "Controlling with onhover=inject() systems"
    }
  };
  const safeNested = deepSanitizeObject(nested);
  assert.ok(!safeNested.payload.includes("<script>"), "Should sanitize deep nested scripts");
  assert.ok(!safeNested.author.bio.includes("onhover"), "Should sanitize deep nested event handlers");
  console.log("  ✔ Deep Object Sanitizer passed");

  // 2. SQLi Defensive Shield Sanitizers
  const cleanSelect = "select our projects where name is simple";
  const sqliThreat = "SELECT * FROM users WHERE id = '1' OR '1'='1' --";
  const sqliThreat2 = "DROP TABLE tenders; --";
  assert.ok(!hasSQLInjectionThreat(cleanSelect), "Should NOT block standard query words");
  assert.ok(hasSQLInjectionThreat(sqliThreat), "Should detect union and drop query threats");
  assert.ok(hasSQLInjectionThreat(sqliThreat2), "Should detect destructive database alter keywords threat");
  console.log("  ✔ SQLi Detector test passed");

  // 3. Form input validation patterns
  assert.ok(validateEmail("msvm220@gmail.com"), "Should validate correct email addresses");
  assert.ok(!validateEmail("invalid_email_no_at"), "Should catch invalid emails lacking @");
  assert.ok(validatePhone("+919876543210"), "Should validate correct corporate mobile syntax");
  assert.ok(!validatePhone("123"), "Should reject extremely short mobile number lengths");
  console.log("  ✔ Input Format Validators passed");

  // 4. Secure File Upload checklist validations
  const validFile = "iso_9001_certificate_revised.pdf";
  const shellFile = "backdoor.php";
  const traverseFile = "../../../etc/passwd.jpg";
  
  const uploadResult = validateUploadedFile(validFile, "application/pdf", 2 * 1024 * 1024);
  assert.ok(uploadResult.isSafe, "Standard PDF under 10MB should pass safety check");
  assert.strictEqual(uploadResult.cleanName, "iso_9001_certificate_revised.pdf", "Should keep alphanumeric filename characters");

  assert.throws(() => {
    validateUploadedFile(shellFile);
  }, /is blocked for platform security grounds/, "Should prevent execution with invalid extensions (.php)");

  assert.throws(() => {
    validateUploadedFile(validFile, "application/pdf", 12 * 1024 * 1024);
  }, /File size limits exceeded/, "Should block uploaded documents that exceed 10MB threshold size limit");

  console.log("  ✔ Secure File Upload validations passed");

  console.log("🎉 All Security shield Unit Tests completed successfully!");
}
