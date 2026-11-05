import { useEffect, useRef, useState } from "react";
import { Environment, Lightformer, useProgress } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Wall from "./Wall";
import Rack from "./Rack";
import Stage from "./Stage";
import Room from "./RoomView";
import { sections, room, hangWorld } from "./sections";
import { toWorld, lookDirection, nearestAngle } from "./room";
import { clamp } from "../lib/math";
import { pan, look, OVERVIEW_PITCH } from "./pan";
import { hideBoot } from "../lib/boot";

const PORTRAIT_VIEW_W = 1.1; // عرض الجدار الظاهر على الجوال (بالمتر)
const PAN_CLICK_LIMIT = 10; // تحرّك أقل من 10 بكسل يُعدّ نقرة وليس سحبًا
const EYE_Y = 1.4; // ارتفاع العين
const SECTION_FOV = 32; // زاوية الرؤية أمام القسم
const OVERVIEW_FOV = 40; // أوسع قليلًا في وضع المتجر ليظهر القضيب والأرضية معًا
const LOOK_SPEED = { x: 0.0045, y: 0.003 }; // حساسية النظر حول الغرفة

// الكاميرا: تنزلق بين "المتجر" (النظر حول الغرفة) وكل قسم (التنقل على جداره)
function CameraRig({ focus, frozen }) {
  const st = useRef({ init: false, last: null, target: new THREE.Vector3() });

  useFrame(({ camera, pointer, size }, dt) => {
    const s = st.current;
    const aspect = size.width / size.height;
    const tanH = Math.tan(THREE.MathUtils.degToRad(SECTION_FOV / 2));
    const sec = sections.find((x) => x.id === focus) ?? null;
    pan.overview = !sec;

    // عند تغيير الوجهة: نصفّر التنقل، ونوجّه النظر نحو القسم الذي غادرناه
    if (s.last !== focus) {
      const prev = sections.find((x) => x.id === s.last);
      if (!sec && prev) {
        look.ty = nearestAngle(prev.frame.rotationY, look.yaw);
        look.yaw = look.ty;
        look.tp = OVERVIEW_PITCH;
        look.pitch = OVERVIEW_PITCH;
      }
      pan.target = 0;
      pan.current = 0;
      s.last = focus;
    }

    let goalPos;
    let goalTarget;

    if (sec) {
      // ----- وضع القسم: نتسع لنرى الجدار، وننتقل بالسحب على امتداده -----
      const L = sec.layout;
      const viewW =
        aspect < 1 ? PORTRAIT_VIEW_W : clamp(L.restWidth + 2 * L.maxDelta + 1.2, 3.4, 4.4);
      const dist = clamp(viewW / (aspect * 2 * tanH), 2.4, 8);
      pan.mpp = (2 * dist * tanH * aspect) / size.width;
      pan.max = Math.max(0, (Math.max(3, L.railLength) - viewW) / 2);
      pan.target = clamp(pan.target, -pan.max, pan.max);
      pan.current = THREE.MathUtils.damp(pan.current, pan.target, 6, dt);

      const k = frozen ? 0 : 1; // حركة خفيفة مع المؤشر (تتوقف عند فتح منتج)
      goalPos = toWorld(sec.frame, [pan.current + pointer.x * 0.12 * k, EYE_Y + pointer.y * 0.05 * k, dist]);
      goalTarget = toWorld(sec.frame, [pan.current, 0.95, 0]); // ننظر قليلًا إلى الأسفل فيظهر طرف الأرضية
    } else {
      // ----- وضع المتجر: نقف وسط الغرفة وننظر حولنا -----
      pan.max = 0;
      look.yaw = THREE.MathUtils.damp(look.yaw, look.ty, 8, dt);
      look.pitch = THREE.MathUtils.damp(look.pitch, look.tp, 8, dt);
      const f = lookDirection(look.yaw, look.pitch);
      goalPos = [room.center[0], EYE_Y, room.center[2]];
      goalTarget = [goalPos[0] + f[0] * 3, goalPos[1] + f[1] * 3, goalPos[2] + f[2] * 3];
    }

    const goalFov = sec ? SECTION_FOV : OVERVIEW_FOV;
    if (!s.init) {
      camera.position.set(...goalPos);
      s.target.set(...goalTarget);
      camera.fov = goalFov;
      s.init = true;
    }
    camera.fov = THREE.MathUtils.damp(camera.fov, goalFov, 4, dt);
    camera.updateProjectionMatrix();
    const lam = 3.5;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, goalPos[0], lam, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, goalPos[1], lam, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, goalPos[2], lam, dt);
    s.target.x = THREE.MathUtils.damp(s.target.x, goalTarget[0], 4, dt);
    s.target.y = THREE.MathUtils.damp(s.target.y, goalTarget[1], 4, dt);
    s.target.z = THREE.MathUtils.damp(s.target.z, goalTarget[2], 4, dt);
    camera.lookAt(s.target);
  });
  return null;
}

// يلتقط السحب بالفأرة أو الإصبع والعجلة: ينقل على الجدار (قسم) أو يدير النظر (المتجر)
function PanControls({ enabled }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    pan.enabled = enabled;
  }, [enabled]);

  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e) => {
      pan.moved = false;
      pan.dragging = false;
      pan.down = { x: e.clientX, y: e.clientY, start: pan.target, yaw: look.ty, pitch: look.tp };
    };
    const onMove = (e) => {
      if (!pan.down || !pan.enabled) return;
      if (!pan.overview && pan.max <= 0) return;
      const dx = e.clientX - pan.down.x;
      const dy = e.clientY - pan.down.y;
      if (!pan.moved && Math.hypot(dx, dy) > PAN_CLICK_LIMIT) {
        pan.moved = true;
        pan.dragging = true;
      }
      if (!pan.moved) return;
      if (pan.overview) {
        look.ty = pan.down.yaw + dx * LOOK_SPEED.x; // السحب يمينًا يدير النظر لليسار
        look.tp = clamp(pan.down.pitch + dy * LOOK_SPEED.y, -0.55, 0.25);
      } else {
        pan.target = clamp(pan.down.start - dx * pan.mpp, -pan.max, pan.max);
      }
    };
    const onUp = () => {
      pan.down = null;
      pan.dragging = false; // نُبقي pan.moved ليعرف حدث النقر أنه كان سحبًا
    };
    const onWheel = (e) => {
      if (!pan.enabled || pan.overview || pan.max <= 0) return;
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      pan.target = clamp(pan.target + d * pan.mpp, -pan.max, pan.max);
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  return null;
}

// يُخفي شاشة التحميل عندما تجهز صور القطع (أو بعد 6 ثوانٍ كحد أقصى)
function BootGate() {
  const progress = useProgress((state) => state.progress);
  useEffect(() => {
    if (progress >= 100) hideBoot();
  }, [progress]);
  useEffect(() => {
    const t = setTimeout(hideBoot, 6000);
    return () => clearTimeout(t);
  }, []);
  return null;
}

// الضوء الذي يصنع الظلال: يتبع القسم الذي نراه ليبقى الظل صحيحًا
function KeyLight({ focus }) {
  const light = useRef();
  useFrame(() => {
    const sec = sections.find((x) => x.id === focus) ?? sections[0];
    if (!sec || !light.current) return;
    const lx = focus === sec.id ? pan.current : 0;
    light.current.position.set(...toWorld(sec.frame, [lx + 0.9, 3.0, 4.4]));
    light.current.target.position.set(...toWorld(sec.frame, [lx, 0, 0]));
    light.current.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      castShadow
      intensity={1.5}
      shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-3}
      shadow-camera-right={3}
      shadow-camera-top={3}
      shadow-camera-bottom={-1}
      shadow-camera-near={0.5}
      shadow-camera-far={14}
      shadow-bias={-0.0004}
      shadow-radius={6}
      shadow-blurSamples={8}
    />
  );
}

export default function Scene({ openId, view, focus, onOpen }) {
  const [shownId, setShownId] = useState(null); // المنتج الذي تعرضه المنصة الآن

  return (
    <>
      {/* انعكاسات للمعدن: ألواح ضوء (softboxes) فقط، بلا صور من الإنترنت */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={0.55} position={[0, 1.5, 9]} scale={[40, 14, 1]} color="#e9e6df" target={[0, 1.5, 0]} />
        <Lightformer form="rect" intensity={3.2} position={[0, 2.4, 6]} scale={[14, 0.9, 1]} target={[0, 1.75, 0]} />
        <Lightformer form="rect" intensity={2.4} position={[0, 5, 3]} scale={[12, 3, 1]} target={[0, 1.75, 0]} />
        <Lightformer form="rect" intensity={1.6} position={[-6, 1.8, 3]} scale={[6, 2, 1]} target={[0, 1.75, 0]} />
        <Lightformer form="rect" intensity={1.6} position={[6, 1.8, 3]} scale={[6, 2, 1]} target={[0, 1.75, 0]} />
      </Environment>

      <KeyLight focus={focus} />
      <Room room={room} decorated={sections.length} />

      {sections.map((s) => (
        <group key={s.id} position={s.frame.position} rotation={[0, s.frame.rotationY, 0]}>
          <Wall width={room.size} />
          <Rack
            items={s.items}
            layout={s.layout}
            openId={openId}
            hiddenId={shownId}
            onOpen={onOpen}
          />
        </group>
      ))}

      <Stage hangWorld={hangWorld} openId={openId} view={view} onShown={setShownId} />
      <CameraRig focus={focus} frozen={!!openId} />
      <PanControls enabled={!openId} />
      <BootGate />
    </>
  );
}
