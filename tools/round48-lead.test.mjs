import assert from "node:assert/strict";
import { test } from "node:test";
import Module from "node:module";

/*
 * ⚠️ סבב 48 — ליד שנשמר דווח לגולש ככשל.
 *
 * ה-`try` היחיד ב-`submitLandingLead` עטף גם את `db.leads.create` וגם
 * את שתי פעולות ההמשך (ההתראה והריענון), ולכן כל חריגה **אחרי**
 * שהשורה נכתבה החזירה `fail("שגיאה זמנית בשמירת הפנייה. נסו שוב בעוד
 * רגע.")` — כלומר הודעה שמזמינה את הגולש לשלוח כפילות על פנייה
 * שנקלטה. ענף הכפילות, 60 שורות מעל, קיבל את ההכרעה ההפוכה במפורש
 * ("בולעת חריגות: הגולש כבר נחשב נשלח") — ואחיו לא.
 */

const state = {
  leads: [],
  revalidateThrows: false,
  notifyThrows: false,
  createThrows: false,
  revalidated: 0,
};

const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "next/headers") {
    return { __esModule: true, headers: async () => new Map() };
  }
  if (/_revalidate$/.test(request)) {
    return {
      __esModule: true,
      revalidateLeadSurfaces: () => {
        if (state.revalidateThrows) throw new Error("revalidatePath נכשל");
        state.revalidated++;
      },
    };
  }
  if (/hotLeadAlert$/.test(request)) {
    return {
      __esModule: true,
      notifyHotLeadAssigned: async () => {
        if (state.notifyThrows) throw new Error("ההתראה נכשלה");
      },
    };
  }
  if (/repositories$/.test(request)) {
    return {
      __esModule: true,
      db: {
        leads: {
          list: async () => ({ rows: [], total: 0 }),
          create: async (data) => {
            if (state.createThrows) throw new Error("הכתיבה נכשלה");
            const lead = { id: `L${state.leads.length + 1}`, ...data };
            state.leads.push(lead);
            return lead;
          },
          addNote: async () => {},
        },
        users: {
          getByEmail: async () => ({ id: "U1", active: true, role: "owner" }),
          listActive: async () => [{ id: "U1", role: "owner" }],
        },
      },
    };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { submitLandingLead } = await import("../src/app/lp/actions.ts");

let phoneSeq = 0;
function form() {
  const fd = new FormData();
  fd.set("name", "דנה כהן");
  // טלפון שונה בכל קריאה, כדי לא ליפול לענף הכפילות.
  fd.set("phone", `05012345${String(10 + phoneSeq++).slice(0, 2)}`);
  fd.set("category", "mobile");
  fd.set("consent", "on");
  fd.set("packageName", "wecom300GB 5G · WeCom");
  fd.set("message", "מהמחשבון: משלם היום ₪220 בחודש · 3 קווים · חיסכון פוטנציאלי ₪1,752 בשנה");
  return fd;
}

function reset() {
  state.leads = [];
  state.revalidateThrows = false;
  state.notifyThrows = false;
  state.revalidated = 0;
}

test("סבב 48: המסלול התקין שומר, מרענן ומדווח `sent`", async () => {
  reset();
  const res = await submitLandingLead(undefined, form());
  assert.equal(res.status, "sent");
  assert.equal(state.leads.length, 1);
  assert.equal(state.revalidated, 1);
});

test("סבב 48: כשל בריענון אחרי השמירה אינו מדווח שגיאה על ליד שנשמר", async () => {
  reset();
  state.revalidateThrows = true;
  const res = await submitLandingLead(undefined, form());
  assert.equal(state.leads.length, 1, "הליד נכתב");
  assert.equal(res.status, "sent", "ולכן הגולש אינו מקבל 'נסו שוב'");
});

test("סבב 48: כשל בהתראה אחרי השמירה אינו מדווח שגיאה", async () => {
  reset();
  state.notifyThrows = true;
  const res = await submitLandingLead(undefined, form());
  assert.equal(state.leads.length, 1);
  assert.equal(res.status, "sent");
});

test("סבב 48: כשל ב-`create` עצמו ממשיך לדווח שגיאה", async () => {
  /*
   * הכיוון חד-צדדי: אסור לדווח כשל על ליד שנשמר — ואסור לדווח
   * הצלחה על ליד שלא נשמר. השער החדש בולע **רק** את מה שאחרי הכתיבה.
   */
  reset();
  state.createThrows = true;
  const res = await submitLandingLead(undefined, form());
  state.createThrows = false;
  assert.equal(state.leads.length, 0);
  assert.equal(res.status, "error");
  assert.match(res.message, /נסו שוב/);
});
