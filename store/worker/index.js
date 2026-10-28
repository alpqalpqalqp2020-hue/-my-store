// ============================================================
// الخادم الصغير: يستقبل الطلبات من المتجر ويرسلها إلى تيليجرام
// يعمل على Cloudflare، ولا يراه الزوار.
//
// الأسرار (لا توضع هنا أبدًا، بل في إعدادات Cloudflare):
//   TELEGRAM_BOT_TOKEN  رمز البوت
//   TELEGRAM_CHAT_ID    معرّف المحادثة (يمكن وضع أكثر من معرّف مفصولة بفاصلة)
// ============================================================

import { products } from "../src/data/products.js";
import { DELIVERY_FEE, GOVERNORATES } from "../src/data/shop.js";
import { normalizePhone, validateCustomer } from "../src/lib/validate.js";

const MAX_BODY = 20_000; // أكبر حجم مقبول للطلب (بالحروف)
const MAX_LINES = 20; // أكبر عدد أصناف في الطلب
const MAX_QTY = 10; // أكبر كمية لكل صنف

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const money = (n) => `${Number(n).toLocaleString("en-US")} د.ع`;

// رقم طلب عشوائي مقروء مثل K7M2QX (بلا أحرف متشابهة)
function makeOrderNo() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/order") {
      if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
      return handleOrder(request, env, url);
    }

    // أي مسار آخر: الموقع نفسه (الملفات الثابتة)
    return env.ASSETS.fetch(request);
  },
};

async function handleOrder(request, env, url) {
  // 1) لا نقبل طلبات من مواقع أخرى
  const origin = request.headers.get("Origin");
  if (origin) {
    let host = "";
    try {
      host = new URL(origin).host;
    } catch {
      /* origin غير صالح */
    }
    if (host !== url.host) return json({ ok: false, error: "origin" }, 403);
  }

  // 2) قراءة الطلب بحجم محدود
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ ok: false, error: "too_large" }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  if (!body || typeof body !== "object") return json({ ok: false, error: "bad_body" }, 400);

  // 3) فخ الروبوتات: الحقل المخفي يجب أن يبقى فارغًا. نردّ "نجاح" وهميًا ولا نرسل شيئًا.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return json({ ok: true, orderNo: makeOrderNo() });
  }

  // 4) فحص بيانات الزبون
  const c = body.customer ?? {};
  const fieldErrors = validateCustomer(c, GOVERNORATES);
  if (Object.keys(fieldErrors).length > 0) {
    return json({ ok: false, error: "invalid_customer", fields: fieldErrors }, 400);
  }
  const customer = {
    name: String(c.name).trim().slice(0, 100),
    phone: normalizePhone(c.phone),
    governorate: c.governorate,
    address: String(c.address).trim().slice(0, 300),
    notes: String(c.notes ?? "").trim().slice(0, 300),
  };

  // 5) فحص المنتجات: نقبل المعرّف والمقاس والكمية فقط، ونحسب السعر بأنفسنا
  const items = body.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_LINES) {
    return json({ ok: false, error: "bad_items" }, 400);
  }
  const lines = [];
  for (const it of items) {
    const product = products.find((p) => p.id === it?.id);
    const qty = Number(it?.qty);
    if (!product) return json({ ok: false, error: "unknown_product" }, 400);
    if (product.sizes[it.size] !== true) return json({ ok: false, error: "size_unavailable", product: product.id, size: it.size }, 400);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return json({ ok: false, error: "bad_qty" }, 400);
    lines.push({ product, size: it.size, qty });
  }
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  const total = subtotal + DELIVERY_FEE;

  // 6) بناء رسالة تيليجرام (نص عادي بلا تنسيق، فلا يستطيع أحد حقن أكواد فيها)
  const orderNo = makeOrderNo();
  const itemLines = lines.map(
    (l, i) => `${i + 1}) ${l.product.name} — مقاس ${l.size} × ${l.qty} = ${money(l.product.price * l.qty)}`
  );
  const message = [
    `🛍 طلب جديد #${orderNo}`,
    "",
    `👤 الاسم: ${customer.name}`,
    `📞 الهاتف: ${customer.phone}`,
    `📍 المحافظة: ${customer.governorate}`,
    `🏠 العنوان: ${customer.address}`,
    customer.notes ? `📝 ملاحظات: ${customer.notes}` : null,
    "",
    "المنتجات:",
    ...itemLines,
    "",
    `المجموع: ${money(subtotal)}`,
    `التوصيل: ${money(DELIVERY_FEE)}`,
    `الإجمالي: ${money(total)}`,
    "💵 الدفع عند الاستلام",
  ]
    .filter((line) => line !== null)
    .join("\n");

  // 7) الإرسال إلى تيليجرام
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatIds = String(env.TELEGRAM_CHAT_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token || chatIds.length === 0) return json({ ok: false, error: "not_configured" }, 500);

  let delivered = 0;
  for (const chatId of chatIds) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
      });
      if (res.ok) delivered++;
    } catch {
      /* نجرّب المعرّف التالي */
    }
  }
  // إذا لم تصل الرسالة لأحد نخبر الزبون ليعيد المحاولة (حتى لا يضيع الطلب بصمت)
  if (delivered === 0) return json({ ok: false, error: "telegram" }, 502);

  return json({ ok: true, orderNo });
}
