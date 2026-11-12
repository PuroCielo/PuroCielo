package com.purocielo.player;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceResponse;
import java.util.Collections;
import java.util.Map;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.Implements;
import org.robolectric.annotation.Implementation;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34, shadows = MainActivityTest.FileChooserResultShadow.class)
public class MainActivityTest {
    // Robolectric не реализует WebViewFactory.parseFileChooserResult.
    // Подменяем только этот системный метод; проверяем маршрутизацию настоящего callback Activity.
    @Implements(WebChromeClient.FileChooserParams.class)
    public static class FileChooserResultShadow {
        @Implementation protected static Uri[] parseResult(int result, Intent data) {
            return result == Activity.RESULT_OK && data != null && data.getData() != null
                    ? new Uri[] { data.getData() } : null;
        }
    }
    static class RecordingActivity extends MainActivity {
        String requested;
        @Override WebResourceResponse serveDoc(String id, Map<String, String> headers) {
            requested = id;
            return null;
        }
    }
    @Test public void documentIdsAreDecodedExactlyOnce() throws Exception {
        RecordingActivity a = new RecordingActivity();
        String id = "primary:Music/100%20real #1.mp3";
        a.serve(Uri.parse("https://puro.local/f/" + Uri.encode(id)), Collections.emptyMap());
        assertEquals(id, a.requested);
    }
    @Test public void webFileChooserReturnsSelectedFileAndCancellation() {
        var controller = Robolectric.buildActivity(MainActivity.class).create();
        MainActivity a = controller.get();
        WebChromeClient client = shadowOf(a.web).getWebChromeClient();
        WebChromeClient.FileChooserParams params = new WebChromeClient.FileChooserParams() {
            public int getMode() { return MODE_OPEN; }
            public String[] getAcceptTypes() { return new String[] { "image/*" }; }
            public boolean isCaptureEnabled() { return false; }
            public CharSequence getTitle() { return "Cover"; }
            public String getFilenameHint() { return null; }
            public Intent createIntent() { return new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*"); }
        };
        final Uri[][] received = new Uri[1][];
        ValueCallback<Uri[]> callback = values -> received[0] = values;
        assertTrue(client.onShowFileChooser(a.web, callback, params));
        assertEquals(MainActivity.REQ_WEB_FILES, shadowOf(a).getNextStartedActivityForResult().requestCode);
        Uri chosen = Uri.parse("content://test/cover.png");
        a.onActivityResult(MainActivity.REQ_WEB_FILES, Activity.RESULT_OK, new Intent().setData(chosen));
        assertArrayEquals(new Uri[] { chosen }, received[0]);
        assertTrue(client.onShowFileChooser(a.web, callback, params));
        a.onActivityResult(MainActivity.REQ_WEB_FILES, Activity.RESULT_CANCELED, null);
        assertNull(received[0]);
        assertNull(a.fileChooserCallback);
        controller.destroy();
    }
}
