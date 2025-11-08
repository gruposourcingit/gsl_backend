import multer from "multer";

// Store files temporarily in memory to upload to Supabase
const storage = multer.memoryStorage();
export const upload = multer({ storage });
