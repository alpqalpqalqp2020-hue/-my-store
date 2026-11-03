// يُخفي شاشة التحميل (#boot) بنعومة. آمن إن استُدعي أكثر من مرة.
let hidden = false;
export function hideBoot() {
  if (hidden) return;
  hidden = true;
  const el = document.getElementById("boot");
  if (!el) return;
  el.classList.add("hide");
  setTimeout(() => el.remove(), 700);
}
