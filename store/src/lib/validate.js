// ============================================================
// فحص بيانات الزبون — يُستعمل في المتصفح وفي الخادم معًا
// ============================================================

const AR = "٠١٢٣٤٥٦٧٨٩"; // أرقام عربية
const FA = "۰۱۲۳۴۵۶۷۸۹"; // أرقام فارسية

// يحوّل الأرقام العربية إلى لاتينية: "٠٧٧٠" ← "0770"
export function toLatinDigits(s) {
  return String(s ?? "")
    .replace(/[٠-٩]/g, (d) => AR.indexOf(d))
    .replace(/[۰-۹]/g, (d) => FA.indexOf(d));
}

// يوحّد شكل رقم الهاتف العراقي إلى 07XXXXXXXXX
export function normalizePhone(raw) {
  let p = toLatinDigits(raw).replace(/[\s\-()]/g, "");
  if (p.startsWith("+964")) p = "0" + p.slice(4);
  else if (p.startsWith("00964")) p = "0" + p.slice(5);
  else if (p.startsWith("964")) p = "0" + p.slice(3);
  else if (/^7\d{9}$/.test(p)) p = "0" + p;
  return p;
}

export const isValidPhone = (p) => /^07\d{9}$/.test(p);

// يرجع كائن أخطاء (فارغ إذا كانت البيانات سليمة)
export function validateCustomer(c, governorates) {
  const errors = {};
  if (String(c.name ?? "").trim().length < 3) errors.name = "اكتب اسمك الكامل";
  if (!isValidPhone(normalizePhone(c.phone))) errors.phone = "رقم غير صحيح، مثال: 07701234567";
  if (!governorates.includes(c.governorate)) errors.governorate = "اختر المحافظة";
  if (String(c.address ?? "").trim().length < 6) errors.address = "اكتب عنوانًا أوضح (المنطقة والشارع وأقرب نقطة دالة)";
  return errors;
}
