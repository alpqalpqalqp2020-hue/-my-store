// تنسيق السعر: 35000 ← "35,000 د.ع"
export const formatPrice = (n) => `${Number(n).toLocaleString("en-US")} د.ع`;
