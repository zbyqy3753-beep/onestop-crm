@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ===================================================================
REM  התקנת בוט התזכורות כמשימה שרצה תמיד על המחשב הזה.
REM  להריץ פעם אחת, אחרי  npm install  ו- npm run pair
REM ===================================================================

REM הרצה מחדש כמנהל אם צריך
net session >nul 2>&1
if not "%errorLevel%"=="0" (
  echo מבקש הרשאות מנהל...
  powershell -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"

echo.
echo === התקנת בוט התזכורות של ONE STOP ===
echo.

if not exist "auth\creds.json" (
  echo [X] הבוט עדיין לא חובר לוואטסאפ.
  echo     הרץ קודם:  npm run pair
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [X] חסר קובץ .env
  echo     העתק את .env.example ל-.env ומלא אותו.
  echo.
  pause
  exit /b 1
)

REM הזרקת הנתיב הנוכחי לתוך ה-XML
set "BOTDIR=%CD%"
powershell -NoProfile -Command ^
  "$xml = Get-Content -Raw -Encoding UTF8 'onestop-wa-bot.xml';" ^
  "$xml = $xml -replace '__BOT_DIR__', [Security.SecurityElement]::Escape($env:BOTDIR);" ^
  "[IO.File]::WriteAllText(\"$env:TEMP\onestop-wa-bot.xml\", $xml, [Text.Encoding]::Unicode)"

schtasks /delete /tn "OneStopWaBot" /f >nul 2>&1
schtasks /create /tn "OneStopWaBot" /xml "%TEMP%\onestop-wa-bot.xml" /ru "SYSTEM"
if errorlevel 1 (
  echo.
  echo [X] יצירת המשימה נכשלה.
  pause
  exit /b 1
)

echo.
echo === הגדרות חשמל ===
echo מונע מהמחשב להיכנס לשינה - אחרת הבוט מתנתק.
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /hibernate off >nul 2>&1

echo.
echo מפעיל את הבוט...
schtasks /run /tn "OneStopWaBot" >nul

echo.
echo ✓ הותקן. הבוט ירוץ אוטומטית גם אחרי הפעלה מחדש של המחשב.
echo.
echo   לבדיקה: פתח את מסך ניהול המערכת - הרצועה למעלה
echo   אמורה להיות ירוקה תוך דקה.
echo.
echo   לעצירה:   schtasks /end  /tn OneStopWaBot
echo   להסרה:    schtasks /delete /tn OneStopWaBot /f
echo   למצב:     schtasks /query /tn OneStopWaBot /v /fo LIST
echo.
pause
