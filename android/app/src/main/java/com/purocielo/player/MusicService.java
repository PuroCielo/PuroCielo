package com.purocielo.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;

/** Держит процесс живым, пока играет музыка, и показывает уведомление с кнопками. */
public class MusicService extends Service {
    static final String CH = "puro_playback";
    MediaSession session;

    @Override public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel c = new NotificationChannel(CH, "Воспроизведение", NotificationManager.IMPORTANCE_LOW);
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);
        }
        session = new MediaSession(this, "PuroCielo");
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { cmd("toggle"); }
            @Override public void onPause() { cmd("toggle"); }
            @Override public void onSkipToNext() { cmd("next"); }
            @Override public void onSkipToPrevious() { cmd("prev"); }
        });
        session.setActive(true);
    }

    void cmd(String c) { MainActivity a = MainActivity.instance; if (a != null) a.command(c); }

    PendingIntent action(String a, int code) {
        Intent i = new Intent(this, MusicService.class).setAction(a);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @Override public int onStartCommand(Intent i, int flags, int id) {
        if (i != null && i.getAction() != null) { cmd(i.getAction()); return START_NOT_STICKY; }
        boolean playing = i != null && i.getBooleanExtra("playing", false);
        String title = i != null ? i.getStringExtra("title") : "", artist = i != null ? i.getStringExtra("artist") : "";
        if (title == null || title.isEmpty()) title = "Puro Cielo";
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS)
                .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f).build());
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(artist).setContentIntent(open).setOngoing(playing).setVisibility(Notification.VISIBILITY_PUBLIC)
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous, "Назад", action("prev", 1)).build())
                .addAction(new Notification.Action.Builder(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, "Пауза", action("toggle", 2)).build())
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next, "Далее", action("next", 3)).build())
                .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
        startForeground(7, b.build());
        if (!playing) stopForeground(STOP_FOREGROUND_DETACH);
        return START_NOT_STICKY;
    }

    @Override public void onDestroy() { if (session != null) session.release(); super.onDestroy(); }
    @Override public IBinder onBind(Intent i) { return null; }
}
