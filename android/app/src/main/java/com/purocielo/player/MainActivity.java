package com.purocielo.player;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;

/** Оболочка: WebView с сайтом из assets/www + доступ к одной выбранной папке с музыкой (SAF). */
public class MainActivity extends Activity {
    static final String HOST = "puro.local";
    static final int REQ_TREE = 41, REQ_NOTIF = 42;
    static MainActivity instance;

    WebView web;
    SharedPreferences prefs;
    final Handler ui = new Handler(Looper.getMainLooper());

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        instance = this;
        prefs = getSharedPreferences("puro", MODE_PRIVATE);
        Window w = getWindow();
        w.setStatusBarColor(0xFF111113); w.setNavigationBarColor(0xFF111113);
        web = new WebView(this);
        web.setBackgroundColor(0xFF111113);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.addJavascriptInterface(new Bridge(), "PuroNative");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                try { return serve(u, r.getRequestHeaders()); } catch (Exception e) { return err(500, "Error"); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                if (HOST.equals(r.getUrl().getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); } catch (Exception ignored) { }
                return true;
            }
        });
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
        web.loadUrl("https://" + HOST + "/index.html");
    }

    // ---------- раздача файлов: assets и выбранная папка ----------
    WebResourceResponse err(int code, String msg) {
        return new WebResourceResponse("text/plain", "utf-8", code, msg, new HashMap<String, String>(), null);
    }

    WebResourceResponse serve(Uri u, Map<String, String> headers) throws IOException {
        String path = u.getPath() == null ? "/" : u.getPath();
        if (path.startsWith("/f/")) return serveDoc(Uri.decode(path.substring(3)), headers);
        if (path.equals("/") || path.isEmpty()) path = "/index.html";
        String name = path.substring(1);
        InputStream in;
        try { in = getAssets().open("www/" + name); } catch (IOException e) { return err(404, "Not found"); }
        String ext = MimeTypeMap.getFileExtensionFromUrl(name);
        String mime = ext.equals("js") ? "text/javascript" : ext.equals("webmanifest") ? "application/manifest+json" : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        if (mime == null) mime = "application/octet-stream";
        Map<String, String> h = new HashMap<>(); h.put("Cache-Control", "no-cache");
        WebResourceResponse r = new WebResourceResponse(mime, mime.startsWith("text/") ? "utf-8" : null, in);
        r.setResponseHeaders(h);
        return r;
    }

    Uri treeUri() { String s = prefs.getString("tree", null); return s == null ? null : Uri.parse(s); }

    WebResourceResponse serveDoc(String docId, Map<String, String> headers) throws IOException {
        Uri tree = treeUri(); if (tree == null) return err(404, "No folder");
        Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree, docId);
        ParcelFileDescriptor pfd = getContentResolver().openFileDescriptor(doc, "r");
        if (pfd == null) return err(404, "Not found");
        long size = pfd.getStatSize();
        String name = docId.substring(docId.lastIndexOf('/') + 1);
        String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "";
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        if (mime == null) mime = ext.equals("flac") ? "audio/flac" : ext.equals("lrc") || ext.startsWith("m3u") ? "text/plain" : "application/octet-stream";
        long start = 0, end = size - 1; boolean partial = false;
        String range = null;
        for (Map.Entry<String, String> e : headers.entrySet()) if (e.getKey().equalsIgnoreCase("Range")) range = e.getValue();
        if (range != null && range.startsWith("bytes=")) {
            String[] p = range.substring(6).split("-", 2);
            try {
                if (p[0].isEmpty()) { start = Math.max(0, size - Long.parseLong(p[1])); }
                else { start = Long.parseLong(p[0]); if (p.length > 1 && !p[1].isEmpty()) end = Math.min(end, Long.parseLong(p[1])); }
                partial = true;
            } catch (NumberFormatException ignored) { }
        }
        if (start > end || start >= size) { pfd.close(); return err(416, "Range Not Satisfiable"); }
        FileInputStream fis = new FileInputStream(pfd.getFileDescriptor());
        fis.getChannel().position(start);
        final long len = end - start + 1;
        final ParcelFileDescriptor keep = pfd;
        InputStream in = new java.io.FilterInputStream(fis) {
            long left = len;
            @Override public int read() throws IOException { if (left <= 0) return -1; int c = super.read(); if (c >= 0) left--; return c; }
            @Override public int read(byte[] b, int o, int l) throws IOException {
                if (left <= 0) return -1; int n = super.read(b, o, (int) Math.min(l, left)); if (n > 0) left -= n; return n; }
            @Override public void close() throws IOException { try { super.close(); } finally { keep.close(); } }
        };
        Map<String, String> h = new HashMap<>();
        h.put("Accept-Ranges", "bytes"); h.put("Content-Length", String.valueOf(len)); h.put("Access-Control-Allow-Origin", "*");
        if (partial) h.put("Content-Range", "bytes " + start + "-" + end + "/" + size);
        WebResourceResponse r = new WebResourceResponse(mime, null, partial ? 206 : 200, partial ? "Partial Content" : "OK", h, in);
        return r;
    }

    // ---------- сканирование папки ----------
    void scan() {
        final Uri tree = treeUri();
        new Thread(() -> {
            JSONObject res = new JSONObject();
            try {
                if (tree == null) throw new IOException("Папка не выбрана");
                JSONArray files = new JSONArray();
                ArrayDeque<String> dirs = new ArrayDeque<>();
                dirs.add(DocumentsContract.getTreeDocumentId(tree));
                String[] cols = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                        DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED};
                while (!dirs.isEmpty()) {
                    String dir = dirs.poll();
                    Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, dir);
                    try (Cursor c = getContentResolver().query(children, cols, null, null, null)) {
                        if (c == null) continue;
                        while (c.moveToNext()) {
                            String id = c.getString(0), name = c.getString(1), mime = c.getString(2);
                            if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) { dirs.add(id); continue; }
                            JSONObject f = new JSONObject();
                            f.put("id", id); f.put("name", name); f.put("size", c.getLong(3)); f.put("mtime", c.getLong(4));
                            files.put(f);
                        }
                    }
                }
                res.put("ok", true); res.put("folder", folderName()); res.put("files", files);
            } catch (Exception e) {
                try { res.put("ok", false); res.put("error", String.valueOf(e.getMessage())); } catch (Exception ignored) { }
            }
            final String js = "window.__puroNative&&window.__puroNative.onScan(" + res + ")";
            ui.post(() -> web.evaluateJavascript(js, null));
        }).start();
    }

    String folderName() {
        Uri t = treeUri(); if (t == null) return "";
        String id = DocumentsContract.getTreeDocumentId(t);
        int i = id.lastIndexOf(':'); String n = i >= 0 ? id.substring(i + 1) : id;
        int j = n.lastIndexOf('/'); return j >= 0 ? n.substring(j + 1) : (n.isEmpty() ? "Память устройства" : n);
    }

    class Bridge {
        @JavascriptInterface public void pickFolder() {
            ui.post(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                startActivityForResult(i, REQ_TREE);
            });
        }
        @JavascriptInterface public void sync() { scan(); }
        @JavascriptInterface public String folderName() { return MainActivity.this.folderName(); }
        @JavascriptInterface public void setPlayback(boolean playing, String title, String artist) {
            Intent i = new Intent(MainActivity.this, MusicService.class);
            i.putExtra("playing", playing); i.putExtra("title", title); i.putExtra("artist", artist);
            try {
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
            } catch (Exception ignored) { }
        }
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_TREE && res == RESULT_OK && data != null && data.getData() != null) {
            Uri u = data.getData();
            getContentResolver().takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            prefs.edit().putString("tree", u.toString()).apply();
            scan();
        }
    }

    /** Команды из уведомления / наушников → JS */
    void command(String c) { ui.post(() -> web.evaluateJavascript("window.__puroCmd&&window.__puroCmd('" + c + "')", null)); }

    @Override public void onBackPressed() {
        web.evaluateJavascript("(window.__puroBack&&window.__puroBack())===true", v -> { if (!"true".equals(v)) moveTaskToBack(true); });
    }
    @Override protected void onDestroy() { if (instance == this) instance = null; super.onDestroy(); }
}
