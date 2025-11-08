const express = require("express");
const sharp = require("sharp");
const router = express.Router();

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

module.exports = (supabase, upload) => {
  // Upload client
  router.post("/", upload.single("logo"), async (req, res) => {
    try {
      const { name, website } = req.body;
      if (!name || !website || !req.file) {
        return res.status(400).json({ message: "Name, website, and logo are required" });
      }

      const sanitizedName = sanitizeFilename(name);
      const filePath = `clients/${sanitizedName}.webp`;

      // Compress logo to WebP
      const webpBuffer = await sharp(req.file.buffer)
        .webp({ quality: 60 })
        .toBuffer();

      // Upload to Supabase storage (bucket: gsl)
      const { error: uploadError } = await supabase.storage
        .from("gsl")
        .upload(filePath, webpBuffer, { contentType: "image/webp", upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return res.status(500).json({ message: "Logo upload failed", error: uploadError });
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("gsl").getPublicUrl(filePath);
      const publicURL = urlData.publicUrl;

      // Insert client into DB
      const { data, error } = await supabase
        .from("clients")
        .insert([{ name, website, logo_url: publicURL }])
        .select()
        .single();

      if (error) return res.status(500).json({ message: "Failed to add client", error });

      res.json(data);
    } catch (err) {
      console.error("Server error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // Get all clients
  router.get("/", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ message: "Failed to fetch clients", error });
      res.json(data);
    } catch (err) {
      console.error("Fetch clients error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // Delete client by ID
  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const { logo_url } = req.body;

    if (!logo_url) return res.status(400).json({ message: "Logo URL required" });

    try {
      const url = new URL(logo_url);
      const pathParts = url.pathname.split("/");
      const bucketName = "gsl";
      const bucketIndex = pathParts.findIndex(part => part === bucketName);
      if (bucketIndex === -1) return res.status(400).json({ message: "Invalid logo URL" });

      const filePath = pathParts.slice(bucketIndex + 1).join("/");

      // Delete from storage
      const { error: deleteError } = await supabase.storage.from(bucketName).remove([filePath]);
      if (deleteError) return res.status(500).json({ message: "Failed to delete logo", error: deleteError });

      // Delete from DB
      const { data, error } = await supabase.from("clients").delete().eq("id", Number(id));
      if (error) return res.status(500).json({ message: "Failed to delete client", error });

      res.json({ message: "Client deleted successfully" });
    } catch (err) {
      console.error("Delete client error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // Edit client by ID
  router.put("/:id", upload.single("logo"), async (req, res) => {
    const { id } = req.params;
    const { name, website } = req.body;
    const newLogo = req.file;

    if (!name || !website) {
      return res.status(400).json({ message: "Name and website are required" });
    }

    try {
      let logo_url;

      // If new logo uploaded
      if (newLogo) {
        // Fetch existing client to delete old logo
        const { data: existingClient, error: fetchError } = await supabase
          .from("clients")
          .select("*")
          .eq("id", Number(id))
          .single();

        if (fetchError || !existingClient) {
          return res.status(404).json({ message: "Client not found", error: fetchError });
        }

        // Delete old logo if exists
        if (existingClient.logo_url) {
          try {
            const url = new URL(existingClient.logo_url);
            const pathParts = url.pathname.split("/");
            const bucketName = "gsl";
            const bucketIndex = pathParts.findIndex(part => part === bucketName);
            if (bucketIndex !== -1) {
              const oldFilePath = pathParts.slice(bucketIndex + 1).join("/");
              await supabase.storage.from(bucketName).remove([oldFilePath]);
            }
          } catch (e) {
            console.warn("Failed to delete old logo:", e.message);
          }
        }

        // Upload new logo
        const sanitizedName = sanitizeFilename(name);
        const filePath = `clients/${sanitizedName}.webp`;

        const webpBuffer = await sharp(newLogo.buffer)
          .webp({ quality: 60 })
          .toBuffer();

        const { error: uploadError } = await supabase.storage
          .from("gsl")
          .upload(filePath, webpBuffer, { contentType: "image/webp", upsert: true });

        if (uploadError) {
          return res.status(500).json({ message: "Logo upload failed", error: uploadError });
        }

        const { data: urlData } = supabase.storage.from("gsl").getPublicUrl(filePath);
        logo_url = urlData.publicUrl;
      }

      // Update client in DB
      const { data, error } = await supabase
        .from("clients")
        .update({ name, website, ...(logo_url ? { logo_url } : {}) })
        .eq("id", Number(id))
        .select()
        .single();

      if (error) return res.status(500).json({ message: "Failed to update client", error });

      res.json(data);
    } catch (err) {
      console.error("Update client error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  return router;
};
