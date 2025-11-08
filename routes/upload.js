const express = require("express");
const multer = require("multer");
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

module.exports = (supabase) => {
  // POST /upload
  router.post("/", upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const { data, error } = await supabase.storage
      .from("mm-files") // your Supabase bucket
      .upload(`uploads/${file.originalname}`, file.buffer, {
        contentType: file.mimetype,
      });

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      message: "File uploaded successfully!",
      path: data.path,
      publicUrl: `https://gcbdoyscrisuiobvyjsl.supabase.co/storage/v1/object/public/mm-files/${data.path}`,
    });
  });

  return router;
};
