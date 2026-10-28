import { useEffect, useState } from "react";
import { products } from "../data/products";
import { CATEGORY_LABELS } from "../data/labels";
import { DELIVERY_FEE, GOVERNORATES, ORDER_ENDPOINT } from "../data/shop";
import { formatPrice } from "../lib/format";
import { normalizePhone, validateCustomer } from "../lib/validate";

const EMPTY_FORM = { name: "", phone: "", governorate: "", address: "", notes: "", website: "" };

// درج السلة: قائمة القطع ← نموذج بيانات الزبون ← شاشة تأكيد
export default function CartDrawer({ open, onClose, cart }) {
  const [step, setStep] = useState("cart"); // cart | checkout | done
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState("");
  const [orderNo, setOrderNo] = useState("");

  // عند الفتح من جديد نعود إلى قائمة السلة (إلا إذا كنا في شاشة التأكيد)
  useEffect(() => {
    if (open && step === "done" && cart.items.length > 0) setStep("cart");
  }, [open, step, cart.items.length]);

  // نربط كل عنصر في السلة ببيانات المنتج
  const lines = cart.items
    .map((it) => ({ ...it, product: products.find((p) => p.id === it.id) }))
    .filter((l) => l.product);
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  const total = subtotal + DELIVERY_FEE;

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validateCustomer(form, GOVERNORATES);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSending(true);
    setServerError("");
    try {
      // نرسل المعرّفات والمقاسات والكميات فقط. الأسعار يحسبها الخادم بنفسه.
      const res = await fetch(ORDER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ id: l.id, size: l.size, qty: l.qty })),
          customer: {
            name: form.name.trim(),
            phone: normalizePhone(form.phone),
            governorate: form.governorate,
            address: form.address.trim(),
            notes: form.notes.trim(),
          },
          website: form.website, // حقل مخفي: البشر لا يملؤونه
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "failed");
      setOrderNo(data.orderNo);
      cart.clear();
      setStep("done");
    } catch {
      setServerError("تعذّر إرسال الطلب. تأكد من الاتصال بالإنترنت وحاول مرة أخرى.");
    } finally {
      setSending(false);
    }
  };

  const finish = () => {
    setStep("cart");
    setForm(EMPTY_FORM);
    onClose();
  };

  const title = step === "checkout" ? "بيانات التوصيل" : step === "done" ? "تم استلام طلبك" : "سلة التسوق";

  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "open" : ""}`} dir="rtl" role="dialog" aria-modal="true" aria-label={title} aria-hidden={!open}>
        <div className="drawer-head">
          {step === "checkout" ? (
            <button className="link-btn" onClick={() => setStep("cart")}>
              ← رجوع
            </button>
          ) : (
            <span />
          )}
          <h2>{title}</h2>
          <button className="x-btn" onClick={step === "done" ? finish : onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        {/* ---------------- 1) قائمة السلة ---------------- */}
        {step === "cart" && (
          <>
            {lines.length === 0 ? (
              <div className="empty">
                <p>سلتك فارغة</p>
                <button className="secondary-btn" onClick={onClose}>
                  تابع التسوق
                </button>
              </div>
            ) : (
              <>
                <ul className="cart-list">
                  {lines.map((l) => (
                    <li key={`${l.id}-${l.size}`} className="cart-item">
                      <img src={`/garments/${l.id}/front.webp?v=1`} alt="" />
                      <div className="ci-main">
                        <div className="ci-name">{l.product.name}</div>
                        <div className="ci-meta">
                          {CATEGORY_LABELS[l.product.category]} · المقاس {l.size}
                        </div>
                        <div className="ci-row">
                          <div className="qty">
                            <button onClick={() => cart.setQty(l.id, l.size, l.qty - 1)} aria-label="أنقص">
                              −
                            </button>
                            <span>{l.qty}</span>
                            <button onClick={() => cart.setQty(l.id, l.size, l.qty + 1)} aria-label="زد">
                              +
                            </button>
                          </div>
                          <div className="ci-price">{formatPrice(l.product.price * l.qty)}</div>
                        </div>
                        <button className="link-btn danger" onClick={() => cart.remove(l.id, l.size)}>
                          إزالة
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="totals">
                  <div>
                    <span>المجموع</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div>
                    <span>التوصيل</span>
                    <span>{formatPrice(DELIVERY_FEE)}</span>
                  </div>
                  <div className="grand">
                    <span>الإجمالي</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>
                <button className="primary-btn" onClick={() => setStep("checkout")}>
                  إتمام الطلب
                </button>
                <p className="note">الدفع عند الاستلام</p>
              </>
            )}
          </>
        )}

        {/* ---------------- 2) نموذج بيانات الزبون ---------------- */}
        {step === "checkout" && (
          <form className="form" onSubmit={submit} noValidate>
            <label>
              الاسم الكامل
              <input value={form.name} onChange={setField("name")} autoComplete="name" />
              {errors.name && <em>{errors.name}</em>}
            </label>
            <label>
              رقم الهاتف
              <input
                value={form.phone}
                onChange={setField("phone")}
                inputMode="tel"
                autoComplete="tel"
                placeholder="07701234567"
                dir="ltr"
              />
              {errors.phone && <em>{errors.phone}</em>}
            </label>
            <label>
              المحافظة
              <select value={form.governorate} onChange={setField("governorate")}>
                <option value="">اختر المحافظة</option>
                {GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {errors.governorate && <em>{errors.governorate}</em>}
            </label>
            <label>
              العنوان
              <textarea rows="3" value={form.address} onChange={setField("address")} autoComplete="street-address" />
              {errors.address && <em>{errors.address}</em>}
            </label>
            <label>
              ملاحظات (اختياري)
              <input value={form.notes} onChange={setField("notes")} />
            </label>

            {/* فخ للبرامج الآلية: حقل لا يراه الإنسان */}
            <input
              className="hp"
              tabIndex="-1"
              autoComplete="off"
              aria-hidden="true"
              value={form.website}
              onChange={setField("website")}
            />

            <div className="totals compact">
              <div className="grand">
                <span>الإجمالي شامل التوصيل</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            {serverError && <p className="server-error">{serverError}</p>}

            <button className="primary-btn" type="submit" disabled={sending}>
              {sending ? "جارٍ الإرسال…" : "تأكيد الطلب"}
            </button>
            <p className="note">الدفع عند الاستلام · سنتصل بك لتأكيد الطلب</p>
          </form>
        )}

        {/* ---------------- 3) تم الطلب ---------------- */}
        {step === "done" && (
          <div className="done">
            <div className="tick">✓</div>
            <p>شكرًا لك! وصلنا طلبك.</p>
            <p className="order-no">
              رقم الطلب: <strong dir="ltr">{orderNo}</strong>
            </p>
            <p className="note">سنتصل بك قريبًا لتأكيد الطلب والتوصيل.</p>
            <button className="primary-btn" onClick={finish}>
              متابعة التسوق
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
