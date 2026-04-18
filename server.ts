import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import cookieParser from "cookie-parser";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const getRedirectUri = (req: express.Request) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    return `${protocol}://${host}/auth/callback`;
  };

  const getOAuth2Client = (req: express.Request) => {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri(req)
    );
  };

  app.get("/api/auth/url", (req, res) => {
    try {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ error: "Google OAuth credentials not configured" });
      }
      const oauth2Client = getOAuth2Client(req);
      const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/drive.file"],
        prompt: "consent",
      });
      res.json({ url });
    } catch (error) {
      console.error("Error generating auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).send("Missing code");
      }
      const oauth2Client = getOAuth2Client(req);
      const { tokens } = await oauth2Client.getToken(code);
      
      // Store tokens in a secure cookie
      res.cookie("google_drive_tokens", JSON.stringify(tokens), {
        secure: true,
        sameSite: "none",
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/drive/status", (req, res) => {
    const tokensCookie = req.cookies.google_drive_tokens;
    if (tokensCookie) {
      res.json({ connected: true });
    } else {
      res.json({ connected: false });
    }
  });

  app.post("/api/drive/disconnect", (req, res) => {
    res.clearCookie("google_drive_tokens", {
      secure: true,
      sameSite: "none",
      httpOnly: true,
    });
    res.json({ success: true });
  });

  app.get("/api/drive/folders", async (req, res) => {
    try {
      const tokensCookie = req.cookies.google_drive_tokens;
      if (!tokensCookie) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tokens = JSON.parse(tokensCookie);
      const oauth2Client = getOAuth2Client(req);
      oauth2Client.setCredentials(tokens);

      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: "files(id, name)",
        orderBy: "name",
      });

      res.json({ folders: response.data.files || [] });
    } catch (error) {
      console.error("Error listing folders:", error);
      res.status(500).json({ error: "Failed to list folders" });
    }
  });

  app.post("/api/drive/upload", async (req, res) => {
    try {
      const tokensCookie = req.cookies.google_drive_tokens;
      if (!tokensCookie) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tokens = JSON.parse(tokensCookie);
      const oauth2Client = getOAuth2Client(req);
      oauth2Client.setCredentials(tokens);

      const { filename, content, mimeType, folderId } = req.body;
      if (!filename || !content) {
        return res.status(400).json({ error: "Missing filename or content" });
      }

      const drive = google.drive({ version: "v3", auth: oauth2Client });
      
      const fileMetadata: any = {
        name: filename,
      };
      if (folderId) {
        fileMetadata.parents = [folderId];
      }

      // If content is base64 (e.g., image), we need to convert it to a stream or buffer
      // If it's text, we can just send it
      let media: any = {
        mimeType: mimeType || "text/plain",
      };

      if (content.startsWith("data:")) {
        // Handle base64 data URI
        const matches = content.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          media.mimeType = matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          
          // Use a stream for the buffer
          const stream = require("stream");
          const bufferStream = new stream.PassThrough();
          bufferStream.end(buffer);
          media.body = bufferStream;
        } else {
          media.body = content;
        }
      } else {
        media.body = content;
      }

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, webViewLink",
      });

      res.json({ success: true, file: file.data });
    } catch (error) {
      console.error("Error uploading to Drive:", error);
      res.status(500).json({ error: "Failed to upload to Drive" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
