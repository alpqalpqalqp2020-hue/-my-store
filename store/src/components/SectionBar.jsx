// شريط الأقسام في أسفل الشاشة: المتجر ← ملابس ← ...
export default function SectionBar({ sections, focus, onFocus }) {
  return (
    <nav className="bar" dir="rtl" aria-label="الأقسام">
      <button
        className={`bar-btn ${focus === "overview" ? "active" : ""}`}
        onClick={() => onFocus("overview")}
      >
        المتجر
      </button>
      {sections.map((s) => (
        <button
          key={s.id}
          className={`bar-btn ${focus === s.id ? "active" : ""}`}
          onClick={() => onFocus(s.id)}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
