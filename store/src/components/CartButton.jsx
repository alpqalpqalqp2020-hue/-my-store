// زر السلة في أعلى الصفحة مع عدّاد العناصر
export default function CartButton({ count, onClick }) {
  return (
    <button className="icon-btn cart-btn" onClick={onClick} aria-label={`السلة، ${count} عنصر`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h14l-1 12H6L5 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      {count > 0 && (
        <span key={count} className="badge">
          {count}
        </span>
      )}
    </button>
  );
}
