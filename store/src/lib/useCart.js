import { useCallback, useEffect, useState } from "react";

// ============================================================
// السلة: قائمة عناصر { id, size, qty } تُحفظ في متصفح الزائر
// ============================================================
const KEY = "my-store-cart-v1";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return []; // إن تعذّر القراءة نبدأ بسلة فارغة
  }
}

export default function useCart() {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* لا مشكلة إن تعذّر الحفظ */
    }
  }, [items]);

  const add = useCallback((id, size) => {
    setItems((cur) => {
      const i = cur.findIndex((x) => x.id === id && x.size === size);
      if (i >= 0) {
        const copy = [...cur];
        copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
        return copy;
      }
      return [...cur, { id, size, qty: 1 }];
    });
  }, []);

  const setQty = useCallback((id, size, qty) => {
    setItems((cur) =>
      cur
        .map((x) => (x.id === id && x.size === size ? { ...x, qty } : x))
        .filter((x) => x.qty > 0)
    );
  }, []);

  const remove = useCallback((id, size) => {
    setItems((cur) => cur.filter((x) => !(x.id === id && x.size === size)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const has = (id, size) => items.some((x) => x.id === id && x.size === size);
  const count = items.reduce((n, x) => n + x.qty, 0);

  return { items, add, setQty, remove, clear, has, count };
}
