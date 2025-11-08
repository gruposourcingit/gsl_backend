const express = require("express");
const sharp = require("sharp");
const router = express.Router();

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

module.exports = (supabase, upload) => {
  // Upload banner
  router.post("/", upload.single("image"), async (req, res) => {
    try {
      const { title } = req.body;
      if (!title || !req.file) {
        return res.status(400).json({ message: "Title and image required" });
      }

      const sanitizedTitle = sanitizeFilename(title);
      const filePath = `banners/${sanitizedTitle}.webp`;

      // Compress to WebP
      const webpBuffer = await sharp(req.file.buffer)
        .webp({ quality: 60 })
        .toBuffer();

      // Upload to Supabase storage (bucket: gsl)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("gsl")
        .upload(filePath, webpBuffer, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return res.status(500).json({ message: "Image upload failed", error: uploadError });
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("gsl")
        .getPublicUrl(filePath);

      const publicURL = urlData.publicUrl;

      // Insert banner into DB
      const { data, error } = await supabase
        .from("banners")
        .insert([{ title, image_url: publicURL }])
        .select()
        .single();

      if (error) {
        return res.status(500).json({ message: "Failed to add banner", error });
      }

      res.json(data);
    } catch (err) {
      console.error("Server error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // Get all banners
  router.get("/", async (req, res) => {
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ message: "Failed to fetch banners", error });
    }
    res.json(data);
  });

  // Delete banner by ID
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const { image_url } = req.body;

    if (!image_url) {
      return res.status(400).json({ message: "Image URL required" });
    }

    try {
      const url = new URL(image_url);
      const pathParts = url.pathname.split("/"); 
      // pathParts = ["", "storage", "v1", "object", "public", "gsl", "banners", "file.webp"]
      const bucketName = "gsl";
      const bucketIndex = pathParts.findIndex(part => part === bucketName);
      if (bucketIndex === -1) return res.status(400).json({ message: "Invalid image URL" });

      const filePath = pathParts.slice(bucketIndex + 1).join("/");

      // Delete from storage
      const { error: deleteError } = await supabase.storage.from(bucketName).remove([filePath]);
      if (deleteError) return res.status(500).json({ message: "Failed to delete image", error: deleteError });

      // Delete from DB
      const { data, error } = await supabase.from("banners").delete().eq("id", id);
      if (error) return res.status(500).json({ message: "Failed to delete banner", error });

      res.json({ message: "Banner deleted successfully" });
    } catch (err) {
      console.error("Delete error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  return router;
};
