// בונה את src/lib/domain/mobicellWorkers.ts מתוך רשימת הנציגים של CallUp.
//
// שימוש: node tools/mobicell/build-workers.mjs tools/mobicell/workers-<תאריך>.json
//
// הקלט: [{ callupWorkerId, callupStoreId, name }], כפי שנשלף מרשימת הנציגים
// (`#workerId` בעמוד /admin/activations ב-crm.onestopil.co; לכל אפשרות יש
// `rel-parent` = מזהה החנות). החנות ממופה לסניף לפי `callupId` ב-branches.ts.
//
// ⚠️ נציג שהיה ברשימה ונעלם ממנה נשאר בקובץ עם `active: false`, ולא נמחק:
// ה-QR שלו כבר מודפס, וליד שמגיע ממנו עדיין צריך להירשם על הסניף ועל שמו.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "src", "lib", "domain", "mobicellWorkers.ts");
const input = process.argv[2];
if (!input) {
  console.error("שימוש: node tools/mobicell/build-workers.mjs <workers.json>");
  process.exit(1);
}

const branchesSrc = readFileSync(join(ROOT, "src", "lib", "domain", "branches.ts"), "utf8");
const storeToCode = new Map(
  [...branchesSrc.matchAll(/code: "([a-z0-9-]+)",[^}]*callupId: (\d+)/g)].map((m) => [Number(m[2]), m[1]]),
);

const fresh = JSON.parse(readFileSync(input, "utf8"));
const previous = existsSync(OUT)
  ? [...readFileSync(OUT, "utf8").matchAll(/\{ id: (\d+), branch: "([a-z0-9-]+)", name: "((?:[^"\\]|\\.)*)", active: (true|false) \}/g)].map(
      (m) => ({ id: Number(m[1]), branch: m[2], name: JSON.parse(`"${m[3]}"`), active: m[4] === "true" }),
    )
  : [];

const byId = new Map(previous.map((w) => [w.id, { ...w, active: false }]));
let skipped = 0;
for (const w of fresh) {
  const branch = storeToCode.get(w.callupStoreId);
  const name = String(w.name ?? "").trim();
  if (!branch || !name) {
    skipped++;
    continue;
  }
  byId.set(w.callupWorkerId, { id: w.callupWorkerId, branch, name, active: true });
}

const workers = [...byId.values()].sort((a, b) => a.id - b.id);
const lines = workers.map(
  (w) => `  { id: ${w.id}, branch: "${w.branch}", name: ${JSON.stringify(w.name)}, active: ${w.active} },`,
);

writeFileSync(
  OUT,
  `/**
 * ── עובדי מוביסל ─────────────────────────────────────────────────────
 *
 * ⚠️ קובץ שנוצר אוטומטית: \`node tools/mobicell/build-workers.mjs <workers.json>\`.
 * לא לערוך ידנית — ההרצה הבאה תדרוס.
 *
 * הנציגים של חנויות מוביסל, כפי שהם רשומים ב-CallUp (\`crm.onestopil.co\`).
 * הם **לא** משתמשי CRM: אין להם התחברות, ולידים לא משויכים אליהם. ל-
 * כל אחד QR אישי (\`<סניף>--w<id>\`), וליד שמגיע ממנו נכנס לחלוקה הרגילה
 * עם קרדיט לנציג ולסניף.
 *
 * \`id\` הוא מזהה הנציג ב-CallUp. ⚠️ הוא מודפס על ה-QR, ולכן אסור לשנות אותו.
 * \`active: false\` = הנציג כבר לא ברשימה של CallUp. הוא נשאר כאן כדי
 * שמדבקה שכבר תלויה תמשיך לתת לו קרדיט, ולא מוצג במסך הסניפים.
 *
 * ⚠️ מודול טהור, בלי ייבוא: משמש גם את מסלול ה-API וגם את המסך.
 */

export type MobicellWorker = {
  id: number;
  /** קוד הסניף ב-\`branches.ts\`. */
  branch: string;
  name: string;
  active: boolean;
};

export const MOBICELL_WORKERS: readonly MobicellWorker[] = [
${lines.join("\n")}
];
`,
);

const active = workers.filter((w) => w.active).length;
console.log(
  `mobicellWorkers.ts: ${active} פעילים, ${workers.length - active} לא פעילים, ${skipped} דולגו (בלי שם או לא בסניף מוביסל)`,
);
