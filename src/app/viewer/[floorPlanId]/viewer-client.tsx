"use client";

import Link from "next/link";
import * as THREE from "three";
import { ArrowLeft, BedDouble, Home, Layers3, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import type { DesignStyle, FloorPlan, Property, Room, ViewingAsset } from "@/lib/types";

export function ViewerClient({
  property,
  floorPlan,
  styles,
}: {
  property: Property;
  floorPlan: FloorPlan;
  styles: DesignStyle[];
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, yaw: 0, pitch: 0 });
  const viewRef = useRef({ fov: 72, pitch: 0, yaw: 0 });
  const [roomId, setRoomId] = useState(floorPlan.rooms[0]?.id ?? "");
  const [styleId, setStyleId] = useState(styles[0]?.id ?? "");
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [fov, setFov] = useState(72);
  const [assetState, setAssetState] = useState("准备加载");
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [viewerError, setViewerError] = useState("");

  const room = useMemo(
    () => floorPlan.rooms.find((item) => item.id === roomId) ?? floorPlan.rooms[0],
    [floorPlan.rooms, roomId],
  );
  const activeStyle = styles.find((style) => style.id === styleId) ?? styles[0];
  const asset = getRoomAsset(room, activeStyle?.id);
  const whiteboxAsset = getRoomAsset(room, "whitebox");
  const activeAsset = asset ?? whiteboxAsset ?? room?.assets[0];
  const activeAssetUrl = activeAsset?.imageUrl ?? "";
  const isFallback = Boolean(activeAsset && asset !== activeAsset && activeStyle?.id !== "whitebox");

  const resizeAndRender = useCallback(() => {
    const shell = shellRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!shell || !renderer || !scene || !camera) {
      return;
    }

    const { fov: currentFov, pitch: currentPitch, yaw: currentYaw } = viewRef.current;
    const width = shell.clientWidth;
    const height = shell.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.fov = currentFov;
    camera.updateProjectionMatrix();
    const phi = THREE.MathUtils.degToRad(90 - Math.max(-85, Math.min(85, currentPitch)));
    const theta = THREE.MathUtils.degToRad(currentYaw);
    camera.lookAt(
      new THREE.Vector3(
        1190 * Math.sin(phi) * Math.sin(theta),
        1190 * Math.cos(phi),
        1190 * Math.sin(phi) * Math.cos(theta),
      ),
    );
    renderer.render(scene, camera);
  }, []);

  useEffect(() => {
    let disposed = false;

    async function setup() {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }

      try {
        if (disposed) {
          return;
        }

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.className = "block size-full";
        stage.innerHTML = "";
        stage.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(viewRef.current.fov, 1, 1, 2400);
        scene.add(camera);

        const geometry = new THREE.SphereGeometry(1200, 96, 64);
        geometry.scale(-1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        rendererRef.current = renderer;
        sceneRef.current = scene;
        cameraRef.current = camera;
        meshRef.current = mesh;
        resizeAndRender();
        setViewerError("");
        setIsViewerReady(true);
      } catch (error) {
        if (!disposed) {
          setViewerError(error instanceof Error ? error.message : "3D 预览启动失败");
          setAssetState("预览不可用");
        }
      }
    }

    setup();

    return () => {
      disposed = true;
      textureRef.current?.dispose();
      const mesh = meshRef.current;
      if (mesh) {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else {
          mesh.material.dispose();
        }
      }
      rendererRef.current?.dispose();
      rendererRef.current?.domElement.remove();
    };
  }, [resizeAndRender]);

  useEffect(() => {
    viewRef.current = { fov, pitch, yaw };
    resizeAndRender();
    window.addEventListener("resize", resizeAndRender);
    return () => window.removeEventListener("resize", resizeAndRender);
  }, [fov, pitch, resizeAndRender, yaw]);

  useEffect(() => {
    setYaw(room?.defaultYaw ?? 0);
    setPitch(0);
    setFov(72);
  }, [room?.defaultYaw, room?.id]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!activeAssetUrl) {
      setAssetState("缺少全景图");
      return;
    }
    if (!isViewerReady || !mesh) {
      setAssetState("准备加载");
      return;
    }

    let cancelled = false;
    setAssetState("正在加载");
    const loader = new THREE.TextureLoader();
    loader.load(
      activeAssetUrl,
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        textureRef.current?.dispose();
        textureRef.current = texture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        const material = mesh.material as THREE.MeshBasicMaterial;
        if (!Array.isArray(material)) {
          material.map = texture;
          material.needsUpdate = true;
        }
        setAssetState(isFallback ? "回退到白膜" : "已加载");
        resizeAndRender();
      },
      undefined,
      () => {
        setAssetState("加载失败");
      },
    );

    return () => {
      cancelled = true;
    };
  }, [activeAssetUrl, isFallback, isViewerReady, resizeAndRender]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!isViewerReady) {
      return;
    }
    dragRef.current = { active: true, x: event.clientX, y: event.clientY, yaw, pitch };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active) {
      return;
    }
    setYaw(drag.yaw - (event.clientX - drag.x) * 0.18);
    setPitch(Math.max(-85, Math.min(85, drag.pitch + (event.clientY - drag.y) * 0.12)));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isViewerReady) {
      return;
    }
    setFov((current) => Math.max(42, Math.min(92, current + event.deltaY * 0.03)));
  }

  const showEmptyState = !activeAssetUrl || assetState === "加载失败";

  if (!room) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-6 text-center text-pearl">
        <div>
          <p className="text-2xl font-bold">这个户型还没有 VR 空间素材</p>
          <Link href={`/floor-plans/${floorPlan.id}`} className="mt-4 inline-flex text-sm font-bold text-gold">
            返回户型详情
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-pearl">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/88 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8 2xl:px-10">
          <Link
            href={`/floor-plans/${floorPlan.id}`}
            className="focus-ring inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold text-pearl/72 hover:text-pearl"
          >
            <ArrowLeft size={16} />
            返回户型
          </Link>
          <FavoriteButton floorPlanId={floorPlan.id} compact />
        </div>
      </header>

      <main className="grid w-full gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 2xl:px-10">
        <section className="min-w-0 space-y-4">
          <div
            ref={shellRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            className="relative min-h-[420px] cursor-grab overflow-hidden rounded-2xl border border-white/10 bg-[#191715] shadow-soft active:cursor-grabbing sm:min-h-[500px] lg:h-[calc(100vh-220px)] lg:min-h-[500px]"
          >
            <div
              ref={stageRef}
              className={`absolute inset-0 transition-opacity duration-300 ${
                isViewerReady && !showEmptyState ? "opacity-100" : "opacity-0"
              }`}
            />
            {!isViewerReady || viewerError || showEmptyState ? (
              <div className="absolute inset-0 z-10 grid place-items-center bg-ink/72 px-6 text-center">
                <div className="max-w-md">
                  <p className="text-xl font-bold">
                    {viewerError
                      ? `3D 预览启动失败：${viewerError}`
                      : showEmptyState
                        ? activeAssetUrl
                          ? "全景图暂时无法加载"
                          : "这个房间还没有全景素材"
                        : "正在启动 3D 预览"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-pearl/62">
                    当前会使用 Three.js 球体全景查看器，启动后可以拖拽画面环视空间。
                  </p>
                </div>
              </div>
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/58 to-transparent p-5 sm:p-6">
              <p className="inline-flex items-center gap-2 rounded-md bg-white/12 px-3 py-1 text-sm font-bold text-pearl/82">
                <RotateCcw size={16} />
                360 VR 看房 · {assetState}
              </p>
              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                {room.name} · {activeStyle?.name ?? "空间"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-pearl/70">
                拖拽画面环视空间，滚轮缩放视角。风格图缺失时会自动回退到白膜底稿。
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/8 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-base font-bold">空间风格</h3>
              <p className="text-xs font-semibold text-pearl/46">切换后保留当前房间视角</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {styles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setStyleId(style.id)}
                  className={`focus-ring min-h-[76px] rounded-lg border px-4 py-3 text-left transition ${
                    style.id === activeStyle?.id
                      ? "border-gold bg-gold text-ink"
                      : "border-white/10 bg-white/8 text-pearl/72 hover:bg-white/14"
                  }`}
                >
                  <span className="block text-sm font-bold">{style.name}</span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-5 opacity-75">
                    {style.description}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/8 p-5">
            <p className="text-sm font-bold text-pearl/50">{property.name}</p>
            <h2 className="mt-2 text-2xl font-bold">{floorPlan.name}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Meta icon={<Home size={16} />} label="户型" value={floorPlan.layout} />
              <Meta icon={<Layers3 size={16} />} label="面积" value={`${floorPlan.area} 平`} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/8 p-5">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <BedDouble size={18} />
              切换房间
            </h3>
            <div className="mt-4 grid gap-2">
              {floorPlan.rooms.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRoomId(item.id)}
                  className={`focus-ring rounded-lg px-4 py-3 text-left text-sm font-bold transition ${
                    item.id === room.id
                      ? "bg-pearl text-ink"
                      : "bg-white/8 text-pearl/72 hover:bg-white/14"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </section>

        </aside>
      </main>
    </div>
  );
}

function getRoomAsset(room: Room | undefined, styleId: string | undefined): ViewingAsset | undefined {
  if (!room || !styleId) {
    return undefined;
  }

  return room.assets.find((item) => item.styleId === styleId && item.qcStatus !== "failed");
}

function Meta({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/8 p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-pearl/46">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-bold text-pearl">{value}</p>
    </div>
  );
}
