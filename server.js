require("dotenv").config();
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "present" : "missing");

const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const multer = require("multer");
const cors = require("cors");

// 🟢 MOVE THIS UP HERE
const authRoute = require("./routes/auth"); 
const { verifyToken } = require("./routes/auth");

const app = express();
app.use(express.json());

const allowedOrigins = [
  'http://localhost:5173',  // local dev frontend
  'https://grupo-sourcin-ltd.onrender.com', // your deployed frontend
//   'https://www.materialsmore.com'
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like Postman or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
}));


// 🟢 Now this works correctly
app.use("/admin", authRoute); // /admin/login now available

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Routes
// const categoriesRoute = require("./routes/categories")(supabase);
const upload = multer({ storage: multer.memoryStorage() });
const bannersRoute = require("./routes/banners")(supabase, upload);
const storageRoute = require("./routes/upload")(supabase, upload);
const clientsRoute = require("./routes/clients")(supabase, upload);
const servicesRoute = require("./routes/services")(supabase, upload);



app.use("/banners", bannersRoute);
app.use("/auth", authRoute); // Optional, for /auth/login if needed
app.use("/clients", clientsRoute);
app.use("/services", servicesRoute);

// app.use("/products", productsRoute);
// app.use("/upload", storageRoute);



// Protected route example
app.get("/admin", verifyToken, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  res.json({ message: `Welcome, ${req.user.username}` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});
