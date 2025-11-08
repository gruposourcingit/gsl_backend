const express = require("express");
const sharp = require("sharp");
const router = express.Router();

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

// Map categories to folder names
const categoryFolderMap = {
  "Knit Showroom": "ks",
  "Woven Showroom": "ws",
  "Sample Section": "ss",
  "Merchandising": "m",
};

module.exports = (supabase, upload) => {
  // Add new service
  router.post("/", upload.single("image"), async (req, res) => {
    try {
      const { category, title } = req.body;
      if (!category || !title || !req.file) {
        return res.status(400).json({ message: "Category, title, and image are required" });
      }

      const folder = categoryFolderMap[category] || "others";
      const sanitizedTitle = sanitizeFilename(title);
      const filePath = `services/${folder}/${sanitizedTitle}.webp`;

      const webpBuffer = await sharp(req.file.buffer)
        .webp({ quality: 60 })
        .toBuffer();

      const { error: uploadError } = await supabase.storage
        .from("gsl")
        .upload(filePath, webpBuffer, { contentType: "image/webp", upsert: true });

      if (uploadError) return res.status(500).json({ message: "Image upload failed", error: uploadError });

      const { data: urlData } = supabase.storage.from("gsl").getPublicUrl(filePath);
      const image_url = urlData.publicUrl;

      const { data, error } = await supabase
        .from("services")
        .insert([{ category, title, image_url }])
        .select()
        .single();

      if (error) return res.status(500).json({ message: "Failed to add service", error });

      res.json(data);
    } catch (err) {
      console.error("Add service error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // Get all services
  router.get("/", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ message: "Failed to fetch services", error });
      res.json(data);
    } catch (err) {
      console.error("Fetch services error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // Delete service
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const { image_url } = req.body;

    if (!image_url) return res.status(400).json({ message: "Image URL required" });

    try {
      const url = new URL(image_url);
      const pathParts = url.pathname.split("/");
      const bucketName = "gsl";
      const bucketIndex = pathParts.findIndex(part => part === bucketName);
      if (bucketIndex === -1) return res.status(400).json({ message: "Invalid image URL" });

      const filePath = pathParts.slice(bucketIndex + 1).join("/");

      const { error: deleteError } = await supabase.storage.from(bucketName).remove([filePath]);
      if (deleteError) return res.status(500).json({ message: "Failed to delete image", error: deleteError });

      const { data, error } = await supabase.from("services").delete().eq("id", id);
      if (error) return res.status(500).json({ message: "Failed to delete service", error });

      res.json({ message: "Service deleted successfully" });
    } catch (err) {
      console.error("Delete service error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // Update service
  router.put("/:id", upload.single("image"), async (req, res) => {
    const { id } = req.params;
    const { category, title } = req.body;
    const newImage = req.file;

    if (!category || !title) return res.status(400).json({ message: "Category and title are required" });

    try {
      let image_url;

      if (newImage) {
        const { data: existingService, error: fetchError } = await supabase
          .from("services")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError || !existingService) return res.status(404).json({ message: "Service not found", error: fetchError });

        if (existingService.image_url) {
          const url = new URL(existingService.image_url);
          const pathParts = url.pathname.split("/");
          const bucketName = "gsl";
          const bucketIndex = pathParts.findIndex(part => part === bucketName);
          if (bucketIndex !== -1) {
            const oldFilePath = pathParts.slice(bucketIndex + 1).join("/");
            await supabase.storage.from(bucketName).remove([oldFilePath]);
          }
        }

        const folder = categoryFolderMap[category] || "others";
        const sanitizedTitle = sanitizeFilename(title);
        const filePath = `services/${folder}/${sanitizedTitle}.webp`;

        const webpBuffer = await sharp(newImage.buffer)
          .webp({ quality: 60 })
          .toBuffer();

        const { error: uploadError } = await supabase.storage
          .from("gsl")
          .upload(filePath, webpBuffer, { contentType: "image/webp", upsert: true });

        if (uploadError) return res.status(500).json({ message: "Image upload failed", error: uploadError });

        const { data: urlData } = supabase.storage.from("gsl").getPublicUrl(filePath);
        image_url = urlData.publicUrl;
      }

      const { data, error } = await supabase
        .from("services")
        .update({ category, title, ...(image_url && { image_url }) })
        .eq("id", id)
        .select()
        .single();

      if (error) return res.status(500).json({ message: "Failed to update service", error });

      res.json(data);
    } catch (err) {
      console.error("Update service error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  return router;
};
