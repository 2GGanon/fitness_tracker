# Fitness Tracker (web)

This repository contains a small static web app (HTML/CSS/JS) for tracking gym sessions and nutrition. It has a basic PWA manifest and a service worker for offline caching.

How to publish to GitHub (using GitHub Desktop)

1. Open GitHub Desktop.
2. File → Add local repository → Choose the `fitness_tracker` folder.
3. Commit any changes if needed, then click `Publish repository` in GitHub Desktop — choose your account and visibility.

Enable GitHub Pages (optional, for PWA features served over HTTPS)

1. In your repository on GitHub, go to Settings → Pages.
2. Select the `main` branch and root (/) as the source, save. The site will be available via HTTPS shortly.

Build an Android APK (Capacitor, recommended)

1. Install Node.js and Android Studio.
2. In the project root, run:

```
npm init -y
npm install @capacitor/cli @capacitor/core --save-dev
npx cap init fitness-tracker com.example.fitnesstracker --web-dir=.
npx cap add android
npx cap open android
```

3. Build/run the Android app from Android Studio (Run → app). The resulting APK can be signed and published.

If you want me to create the remote repo and push from here using the `gh` CLI, say so — you'll need to allow authentication.
# Fitness Tracker (simple local web app)

Files:
- index.html — main UI
- app.js — JavaScript logic and storage
- styles.css — basic styling

Usage:
1. Open [fitness_tracker/index.html](fitness_tracker/index.html) in a browser.
2. Click "Add Exercise" to open a compact input, type the exercise name and click "Confirm".
3. Click "Start New Session", then for each exercise click "Add Set" and enter weight & reps.
4. Click "Finish Session" to persist in browser localStorage.

Personal bests shown per exercise: heaviest single set, highest reps, and highest volume (weight×reps).
