const VIEW_KEYS = ["front", "side", "back"];

// عرض صورة المنتج الكبيرة في وضع القائمة (بدل المنصة ثلاثية الأبعاد)
export default function Viewer2D({ product, view }) {
  return (
    <div className="viewer2d">
      <img
        key={`${product.id}-${view}`}
        src={`/garments/${product.id}/${VIEW_KEYS[view]}.webp?v=1`}
        alt={product.name}
        draggable="false"
      />
    </div>
  );
}
