import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import Scene from "./scene/Scene";
import ProductPanel from "./components/ProductPanel";
import CartButton from "./components/CartButton";
import CartDrawer from "./components/CartDrawer";
import useCart from "./lib/useCart";
import { products, STORE_NAME, STORE_TAGLINE } from "./data/products";

export default function App() {
  const [openId, setOpenId] = useState(null); // المنتج المفتوح
  const [view, setView] = useState(0); // 0 أمام ، 1 جانب ، 2 خلف
  const [size, setSize] = useState(null); // المقاس المختار
  const [cartOpen, setCartOpen] = useState(false); // درج السلة
  const cart = useCart();

  const product = products.find((p) => p.id === openId) ?? null;

  const open = useCallback((id) => {
    setOpenId(id);
    setView(0);
    setSize(null);
  }, []);
  const close = useCallback(() => setOpenId(null), []);

  // زر Esc يغلق السلة أولًا، ثم المنتج
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (cartOpen) setCartOpen(false);
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, cartOpen]);

  return (
    <div className="app">
      <Canvas
        shadows="variance"
        dpr={[1, 2]}
        camera={{ position: [0, 1.5, 3.3], fov: 32, near: 0.1, far: 40 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          // ألوان صادقة للمنتجات
          gl.toneMapping = THREE.NeutralToneMapping;
        }}
      >
        <Suspense fallback={null}>
          <Scene openId={openId} view={view} onOpen={open} />
        </Suspense>
      </Canvas>

      <header className="header">
        <div className="brand">{STORE_NAME}</div>
        <div className="tagline">{STORE_TAGLINE}</div>
      </header>

      {product && (
        <button className="close-btn" onClick={close}>
          إغلاق
        </button>
      )}

      <div className="top-right">
        <CartButton count={cart.count} onClick={() => setCartOpen(true)} />
      </div>

      {product && (
        <ProductPanel
          product={product}
          view={view}
          onView={setView}
          size={size}
          onSize={setSize}
          inCart={!!size && cart.has(product.id, size)}
          onAdd={() => cart.add(product.id, size)}
          cartCount={cart.count}
          onViewCart={() => setCartOpen(true)}
        />
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} />

      {!product && !cartOpen && <div className="hint">مرّر المؤشر على القطعة وانقر عليها · على الجوال المسها مرتين</div>}
    </div>
  );
}
