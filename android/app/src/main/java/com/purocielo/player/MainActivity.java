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
import java.util.LinkedHashSet;
import java.util.Set;
import android.util.Base64;
import android.provider.OpenableColumns;
import java.util.Map;

/** Оболочка: WebView с сайтом из assets/www + доступ к одной выбранной папке с музыкой (SAF). */
public class MainActivity extends Activity {
    static final String HOST = "puro.local";
    static final int REQ_TREE = 41, REQ_NOTIF = 42, REQ_FILES = 43;
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

    // ---------- отдельные файлы, добавленные по одному ----------
    Set<String> singles() {
        Set<String> out = new LinkedHashSet<>();
        try { JSONArray a = new JSONArray(prefs.getString("files", "[]")); for (int i = 0; i < a.length(); i++) out.add(a.getString(i)); } catch (Exception ignored) { }
        return out;
    }
    void saveSingles(Set<String> s) { prefs.edit().putString("files", new JSONArray(s).toString()).apply(); }
    String docNameOf(Uri u) {
        try (Cursor c = getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst() && c.getString(0) != null) return c.getString(0);
        } catch (Exception ignored) { }
        return "track";
    }
    static String singleId(String uri) { try { return "uri:" + Base64.encodeToString(uri.getBytes("UTF-8"), Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING); } catch (Exception e) { return "uri:"; } }

    Uri treeUri() { String s = prefs.getString("tree", null); return s == null ? null : Uri.parse(s); }

    WebResourceResponse serveDoc(String docId, Map<String, String> headers) throws IOException {
        Uri doc; String nameHint = docId;
        if (docId.startsWith("uri:")) {
            try { doc = Uri.parse(new String(Base64.decode(docId.substring(4), Base64.URL_SAFE | Base64.NO_WRAP), "UTF-8")); } catch (Exception e) { return err(404, "Bad id"); }
            nameHint = docNameOf(doc);
        } else {
            Uri tree = treeUri(); if (tree == null) return err(404, "No folder");
            doc = DocumentsContract.buildDocumentUriUsingTree(tree, docId);
        }
        ParcelFileDescriptor pfd = getContentResolver().openFileDescriptor(doc, "r");
        if (pfd == null) return err(404, "Not found");
        long size = pfd.getStatSize();
        String name = nameHint.substring(nameHint.lastIndexOf('/') + 1);
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
                Set<String> one = singles();
                if (tree == null && one.isEmpty()) throw new IOException("Ничего не выбрано");
                JSONArray files = new JSONArray();
                for (String us : one) {
                    Uri u = Uri.parse(us);
                    try (Cursor c = getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
                        if (c == null || !c.moveToFirst()) continue;
                        JSONObject f = new JSONObject();
                        f.put("id", singleId(us)); f.put("name", c.getString(0) == null ? "track" : c.getString(0)); f.put("size", c.getLong(1));
                        f.put("mtime", 0); files.put(f);
                    } catch (Exception ignored) { }
                }
                if (tree != null) {
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
        @JavascriptInterface public void pickFiles() {
            ui.post(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"audio/*", "application/ogg", "application/octet-stream"});
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                startActivityForResult(i, REQ_FILES);
            });
        }
        @JavascriptInterface public void forget(String docId) {
            if (docId == null || !docId.startsWith("uri:")) return;
            try {
                String uri = new String(Base64.decode(docId.substring(4), Base64.URL_SAFE | Base64.NO_WRAP), "UTF-8");
                Set<String> s = singles(); if (s.remove(uri)) saveSingles(s);
            } catch (Exception ignored) { }
        }
        @JavascriptInterface public void sync() { scan(); }
        @JavascriptInterface public void fetchText(String id, String url) { fetchAsync(id, url); }
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
        if (req == REQ_FILES && res == RESULT_OK && data != null) {
            Set<String> s = singles(); java.util.List<Uri> picked = new java.util.ArrayList<>();
            if (data.getClipData() != null) for (int i = 0; i < data.getClipData().getItemCount(); i++) picked.add(data.getClipData().getItemAt(i).getUri());
            else if (data.getData() != null) picked.add(data.getData());
            for (Uri u : picked) {
                try { getContentResolver().takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception ignored) { }
                s.add(u.toString());
            }
            saveSingles(s); scan();
            return;
        }
        if (req == REQ_TREE && res == RESULT_OK && data != null && data.getData() != null) {
            Uri u = data.getData();
            getContentResolver().takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            prefs.edit().putString("tree", u.toString()).apply();
            scan();
        }
    }

    /** Загрузка страницы для поиска текстов на сайтах (в WebView это запрещено CORS). Только известные хосты. */
    static final String[] HOSTS = {"genius.com", "www.azlyrics.com", "www.lyrics.com", "text-pesni.com", "vse-pesni.com", "www.text-pesni.com", "www.vse-pesni.com", "search.azlyrics.com", "lyrics.com"};
    void fetchAsync(final String id, final String url) {
        new Thread(() -> {
            String out = "";
            try {
                Uri u = Uri.parse(url);
                boolean ok = "https".equals(u.getScheme()) && u.getHost() != null;
                if (ok) { ok = false; for (String h : HOSTS) if (h.equals(u.getHost())) ok = true; }
                if (ok) {
                    java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                    c.setConnectTimeout(9000); c.setReadTimeout(12000); c.setInstanceFollowRedirects(true);
                    c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36");
                    c.setRequestProperty("Accept-Language", "ru,en;q=0.8");
                    if (c.getResponseCode() == 200) {
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n;
                        try (InputStream in = c.getInputStream()) { while ((n = in.read(buf)) > 0 && bo.size() < 4_000_000) bo.write(buf, 0, n); }
                        String ct = c.getContentType() == null ? "" : c.getContentType().toLowerCase();
                        out = bo.toString(ct.contains("1251") ? "windows-1251" : "UTF-8");
                    }
                }
            } catch (Exception ignored) { }
            final String js = "window.__puroNative&&window.__puroNative.onFetch(" + JSONObject.quote(id) + "," + JSONObject.quote(out) + ")";
            ui.post(() -> web.evaluateJavascript(js, null));
        }).start();
    }

    /** Команды из уведомления / наушников → JS */
    void command(String c) { ui.post(() -> web.evaluateJavascript("window.__puroCmd&&window.__puroCmd('" + c + "')", null)); }

    @Override public void onBackPressed() {
        web.evaluateJavascript("(window.__puroBack&&window.__puroBack())===true", v -> { if (!"true".equals(v)) moveTaskToBack(true); });
    }
    @Override protected void onDestroy() { if (instance == this) instance = null; super.onDestroy(); }
}
