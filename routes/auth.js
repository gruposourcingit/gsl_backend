const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const router = express.Router();

const supabase = require("../supabase");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
// const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || "6Ld3oZwrAAAAAF4a6Gs569WtZEH-hQY83Xlf2ff1"; // Replace with real key for production

// Login route with captcha verification
router.post("/login", async (req, res) => {
  const { username, password, captchaToken } = req.body;

  console.log("\n=== Login Attempt ===");
  console.log("Username:", username);
  console.log("Password Provided:", !!password);
//   console.log("Captcha Token Provided:", !!captchaToken);

  // Check required fields
  if (!username || !password ) {  //|| !captchaToken
    console.warn("Missing fields in request body");
    return res.status(400).json({ message: "Username, password, and captcha are required" });
  }

  // ✅ CAPTCHA Verification
//   try {
//     console.log("Verifying CAPTCHA...");
//     const captchaRes = await fetch(
//       `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${captchaToken}`,
//       { method: "POST" }
//     );
//     const captchaJson = await captchaRes.json();
//     console.log("Captcha response:", captchaJson);

//     if (!captchaJson.success) {
//       console.warn("Captcha failed");
//       return res.status(403).json({ message: "Captcha verification failed" });
//     }
//   } catch (captchaErr) {
//     console.error("Captcha error:", captchaErr);
//     return res.status(500).json({ message: "Captcha verification error" });
//   }

  // ✅ Check user in Supabase
  try {
    console.log("Looking up user in Supabase...");
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !data) {
      console.warn("User not found or error:", error);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("User found:", data.username);

    // Compare password
    const passwordMatch = await bcrypt.compare(password, data.password);
    console.log("Password match:", passwordMatch);

    if (!passwordMatch) {
      console.warn("Incorrect password");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check role
    if (data.role !== "admin") {
      console.warn("Access denied. Role:", data.role);
      return res.status(403).json({ message: "Access denied" });
    }

    // Generate token
    const token = jwt.sign(
      { userId: data.id, username: data.username, role: data.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log("Login successful. Token generated.");
    return res.json({ token });
  } catch (dbErr) {
    console.error("Database error:", dbErr);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// JWT verification middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Invalid token format" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.warn("Token verification failed:", err.message);
    return res.status(401).json({ message: "Token expired or invalid" });
  }
}

module.exports = router;
module.exports.verifyToken = verifyToken;
