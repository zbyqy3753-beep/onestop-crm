"""
הצד של המחשב בניתוח השיחות של אלירן.

בכל דקה: מושך מה-CRM הקלטות שהועלו מהטלפון, מתמלל אותן כאן במחשב
(Whisper של ivrit-ai, בלי שהשמע יוצא לשום שירות), מעביר את התמליל
ל-Claude דרך `claude -p` על המנוי הקיים, ומחזיר את הניתוח ל-CRM.
אחרי ההחזרה השרת מוחק את השמע.

הרצה:  python tools/calls/worker.py          (לולאה)
        python tools/calls/worker.py --once   (סבב אחד ויציאה)

תצורה ב-tools/calls/.worker.env (לא בגיט):
    CALLS_BASE_URL=https://...
    CALLS_WORKER_KEY=...

⚠️ PyAV חייב להיות מתחת ל-14 (`pip install "av<14"`). faster-whisper 1.2
מעביר ל-av.open פרמטר שהוסר בגרסה 14, והתמלול נופל בשגיאת TypeError.
"""

import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
MODEL_NAME = "ivrit-ai/whisper-large-v3-turbo-ct2"
POLL_SECONDS = 60
CLAUDE_TIMEOUT = 300

_model = None


def log(msg: str) -> None:
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {msg}"
    print(line, flush=True)
    with open(HERE / "worker.log", "a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_config() -> tuple[str, str]:
    env_file = HERE / ".worker.env"
    values = {}
    if env_file.exists():
        for raw in env_file.read_text(encoding="utf-8").splitlines():
            if "=" in raw and not raw.lstrip().startswith("#"):
                k, v = raw.split("=", 1)
                values[k.strip()] = v.strip()
    base = os.environ.get("CALLS_BASE_URL") or values.get("CALLS_BASE_URL", "")
    key = os.environ.get("CALLS_WORKER_KEY") or values.get("CALLS_WORKER_KEY", "")
    if not base or not key:
        sys.exit(f"חסרים CALLS_BASE_URL או CALLS_WORKER_KEY ב-{env_file}")
    return base.rstrip("/"), key


def model():
    # נטען פעם אחת ונשאר בזיכרון (~1.5GB). טעינה לוקחת ~15 שניות.
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        log("טוען את מודל התמלול...")
        _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
    return _model


def transcribe(path: str) -> str:
    segments, _ = model().transcribe(path, language="he", beam_size=1, vad_filter=True)
    return "\n".join(s.text.strip() for s in segments if s.text.strip())


def analyze(transcript: str, meta: dict) -> str:
    prompt = (HERE / "prompt.md").read_text(encoding="utf-8")
    header = f"מספר הלקוח: {meta.get('phone') or 'לא ידוע'}\n"
    if meta.get("durationSec"):
        header += f"אורך השיחה: {meta['durationSec'] // 60} דק׳ {meta['durationSec'] % 60} שנ׳\n"
    stdin = f"{prompt}\n\n---\n{header}\nהתמליל:\n{transcript}\n"

    # ⚠️ בלי כלים ובלי MCP: זה ניתוח טקסט בלבד, ותמליל של לקוח לא אמור
    # להיות מסוגל לגרום לשום פעולה במחשב.
    result = subprocess.run(
        [
            "claude",
            "-p",
            "--tools",
            "",
            "--strict-mcp-config",
            "--no-session-persistence",
            "--output-format",
            "text",
        ],
        input=stdin,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=CLAUDE_TIMEOUT,
        cwd=tempfile.gettempdir(),
    )
    out = (result.stdout or "").strip()
    if result.returncode != 0 or not out:
        raise RuntimeError(f"claude נכשל ({result.returncode}): {(result.stderr or out)[:300]}")
    return out


def process(base: str, headers: dict, rec: dict) -> None:
    rid = rec["id"]
    suffix = Path(rec["fileName"]).suffix or ".m4a"
    log(f"מטפל ב-{rec['fileName']} ({rec.get('phone')})")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        for i in range(rec["chunkCount"]):
            r = requests.get(f"{base}/api/calls/{rid}/chunks/{i}", headers=headers, timeout=120)
            r.raise_for_status()
            tmp.write(r.content)
        audio = tmp.name

    try:
        started = time.time()
        transcript = transcribe(audio)
        log(f"  תומלל ב-{time.time() - started:.0f} שנ׳, {len(transcript)} תווים")
        if len(transcript) < 20:
            body = {"status": "failed", "error": "לא נשמע דיבור בהקלטה", "transcript": transcript}
        else:
            body = {"status": "done", "transcript": transcript, "analysis": analyze(transcript, rec)}
    except Exception as e:  # noqa: BLE001 — כל כישלון חוזר לאפליקציה כהסבר
        log(f"  נכשל: {e}")
        body = {"status": "failed", "error": str(e)[:900]}
    finally:
        os.unlink(audio)

    r = requests.patch(f"{base}/api/calls/{rid}", json=body, headers=headers, timeout=60)
    log(f"  הוחזר: {body['status']} ({r.status_code})")


def tick(base: str, headers: dict) -> None:
    r = requests.get(f"{base}/api/calls/queue", headers=headers, timeout=60)
    r.raise_for_status()
    for rec in r.json().get("recordings", []):
        process(base, headers, rec)


def main() -> None:
    base, key = load_config()
    headers = {"authorization": f"Bearer {key}"}
    once = "--once" in sys.argv
    log(f"התחיל ({base})")
    while True:
        try:
            tick(base, headers)
        except Exception as e:  # noqa: BLE001 — רשת שנפלה לא עוצרת את הלולאה
            log(f"שגיאה בסבב: {e}")
        if once:
            return
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
