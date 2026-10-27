// ============================================================
// بيانات المتجر والمنتجات — عدّلها بما يناسبك
// ============================================================

// اسم متجرك (يظهر في الأعلى). غيّره إلى اسمك أنت.
export const STORE_NAME = "MY STORE";
export const STORE_TAGLINE = "VIRTUAL STORE";

// قائمة المنتجات. "id" يجب أن يطابق اسم المجلد في public/garments
// وكذلك اسم المنتج في ملف garmentViews.json
export const products = [
  {
    id: "hoodie-green",
    category: "clothing",
    name: "هودي أخضر غابي",
    price: 35000, // بالدينار العراقي (غيّره للسعر الحقيقي)
    colorway: "أخضر غابي",
    // true = المقاس متوفر ، false = نفد
    sizes: { S: true, M: true, L: false, XL: true },
  },
];
