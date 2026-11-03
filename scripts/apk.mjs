// Reconstruit l'APK Android (TWA) et le dépose dans public/ : au prochain déploiement,
// le bouton « Envoyer l'app Android » du Profil donne cette version.
// Usage : npm run apk  (puis npm run deploy)
import { execSync } from 'node:child_process';
import { copyFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Gradle 8 ne tourne pas avec le Java 25 par défaut de la machine.
const JAVA_HOME = process.env.JAVA_HOME_17 ?? join(homedir(), '.jdks', 'jdk-17.0.20.1+1');
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
execSync(`${gradlew} assembleRelease`, { cwd: 'android', stdio: 'inherit', env: { ...process.env, JAVA_HOME } });

const out = 'android/app/build/outputs/apk/release/app-release.apk';
copyFileSync(out, 'public/agenda-a-deux.apk');
console.log(`APK copié dans public/agenda-a-deux.apk (${Math.round(statSync(out).size / 1024)} Ko)`);
