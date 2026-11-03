import { formatPrice } from "../lib/format";
import { CATEGORY_LABELS } from "../data/labels";

// قائمة المنتجات العادية (بديل للمتجر ثلاثي الأبعاد)
export default function ListView({ products, onOpen }) {
  return (
    <main className="list-view" dir="rtl">
      <div className="list-grid">
        {products.map((p) => (
          <button key={p.id} className="list-card" onClick={() => onOpen(p.id)}>
            <div className="list-img">
              <img src={`/garments/${p.id}/front.webp?v=1`} alt={p.name} loading="lazy" draggable="false" />
            </div>
            <div className="list-cat">{CATEGORY_LABELS[p.category] ?? p.category}</div>
            <div className="list-name">{p.name}</div>
            <div className="list-price">{formatPrice(p.price)}</div>
          </button>
        ))}
      </div>
    </main>
  );
}
