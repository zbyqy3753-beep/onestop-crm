@echo off
rem מפעיל את worker התמלול והניתוח של מאמן השיחות ברקע, בלי חלון.
rem הלוג נכתב ל-worker.log שבאותה תיקייה.
cd /d "%~dp0"
start "" pythonw worker.py
