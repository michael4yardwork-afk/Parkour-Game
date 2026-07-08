import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Save, Play, Trash2, ArrowLeft, Move, RotateCcw, Compass, ZoomIn, ZoomOut } from 'lucide-react';
import { LevelConfig, BlockConfig, BlockType, SceneTheme } from '../types';
import { hasVulgarLanguage } from '../utils';

interface LevelEditorProps {
  initialLevel?: LevelConfig | null;
  onSave: (level: LevelConfig) => void;
  onExit: (level?: LevelConfig) => void;
  onTest: (level: LevelConfig) => void;
}

export default function LevelEditor({ initialLevel, onSave, onExit, onTest }: LevelEditorProps) {
  // Try to restore draft if no specific level is being edited
  const getInitialValue = () => {
    if (initialLevel) return initialLevel;
    const saved = localStorage.getItem('momentum_builder_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as LevelConfig;
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  };

  const restoredLevel = getInitialValue();

  const [levelName, setLevelName] = useState(restoredLevel?.name || 'My New Course');
  const levelDesc = restoredLevel?.description || 'Can you reach the finish line?';
  const [theme, setTheme] = useState<SceneTheme>(restoredLevel?.theme || 'sky_islands');
  
  const [blocks, setBlocks] = useState<BlockConfig[]>(restoredLevel?.blocks || [
    // Provide a starting spawn and goal by default
    { id: 'start_pad', type: 'start', x: 0, y: 0, z: 0, w: 6, h: 1, d: 6 },
    { id: 'end_pad', type: 'end', x: 0, y: 6, z: -35, w: 6, h: 1, d: 6 }
  ]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>('start_pad');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Camera viewport adjustment states
  const [cameraZoom, setCameraZoom] = useState<number>(30); // camera distance from target
  const [cameraRotation, setCameraRotation] = useState<number>(31); // orbit angle in degrees
  const [cameraHeight, setCameraHeight] = useState<number>(18); // height above target
  const [panX, setPanX] = useState<number>(0);
  const [panZ, setPanZ] = useState<number>(-15);

  const handleResetCamera = () => {
    setCameraZoom(30);
    setCameraRotation(31);
    setCameraHeight(18);
    setPanX(0);
    setPanZ(-15);
  };

  // Drag-to-rotate state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    if (e.shiftKey) {
      // Shift drag pans the target targetX/targetZ
      const cosRot = Math.cos((cameraRotation * Math.PI) / 180);
      const sinRot = Math.sin((cameraRotation * Math.PI) / 180);
      const panSpeed = cameraZoom * 0.003; // speed scales with zoom level
      setPanX(prev => prev - (dx * cosRot + dy * sinRot) * panSpeed);
      setPanZ(prev => prev - (-dx * sinRot + dy * cosRot) * panSpeed);
    } else {
      // Normal drag orbits
      setCameraRotation(prev => {
        let next = prev - dx * 0.4;
        if (next > 180) next -= 360;
        if (next < -180) next += 360;
        return next;
      });
      setCameraHeight(prev => Math.min(75, Math.max(-15, prev + dy * 0.2)));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    setCameraZoom(prev => Math.min(150, Math.max(5, prev + e.deltaY * 0.05)));
  };

  useEffect(() => {
    // Reset panning offset to default when a new block is selected to focus on it
    setPanX(0);
    setPanZ(-15);
  }, [selectedBlockId]);

  const handleResetCourse = () => {
    setBlocks([
      { id: 'start_pad', type: 'start', x: 0, y: 0, z: 0, w: 6, h: 1, d: 6 },
      { id: 'end_pad', type: 'end', x: 0, y: 6, z: -35, w: 6, h: 1, d: 6 }
    ]);
    setSelectedBlockId('start_pad');
    setLevelName('My New Course');
    setShowResetConfirm(false);

    // Reset the PR that it says in the test run
    localStorage.removeItem('best_time_test_level_active');
    localStorage.removeItem('ghost_replay_test_level_active');

    // Also reset PR for the current level being edited if applicable
    const currentId = initialLevel?.id || 'momentum_builder_draft_temp_id';
    localStorage.removeItem(`best_time_${currentId}`);
    localStorage.removeItem(`ghost_replay_${currentId}`);
  };

  // Continuous auto-save draft locally on any configuration changes
  useEffect(() => {
    const draft: LevelConfig = {
      id: initialLevel?.id || 'momentum_builder_draft_temp_id',
      name: levelName,
      description: levelDesc,
      theme: theme,
      blocks: blocks,
      isCustom: true
    };
    localStorage.setItem('momentum_builder_draft', JSON.stringify(draft));
  }, [levelName, levelDesc, theme, blocks, initialLevel]);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Three.js References
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshesRef = useRef<{ [id: string]: THREE.Mesh }>({});
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  // Initialize Scene
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create scene, camera, renderer
    const width = canvasRef.current.clientWidth;
    const height = canvasRef.current.clientHeight;

    const scene = new THREE.Scene();
    // Use darker gray theme for editor to differentiate from gameplay
    scene.background = new THREE.Color(0x18181b);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(15, 18, 25);
    camera.lookAt(0, 0, -15);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(10, 20, 15);
    scene.add(dirLight);

    // Helpers
    const gridHelper = new THREE.GridHelper(200, 100, 0x4f46e5, 0x334155);
    gridHelper.position.y = -0.52;
    scene.add(gridHelper);

    // Make axis reference
    const axesHelper = new THREE.AxesHelper(10);
    axesHelper.position.set(-8, 0, 8);
    scene.add(axesHelper);

    sceneRef.current = scene;
    cameraRef.current = camera;
    gridHelperRef.current = gridHelper;
    rendererRef.current = renderer;

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      
      // Slow rotation just to give 3D depth to editors
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h, false);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update visual meshes when block config changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear existing block meshes
    for (const id in meshesRef.current) {
      const mesh = meshesRef.current[id];
      if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
    meshesRef.current = {};

    // Re-create from blocks state
    blocks.forEach(block => {
      let color = 0x64748b; // neutral steel
      let opacity = 1.0;
      let transparent = false;

      switch (block.type) {
        case 'start':
          color = 0x10b981; // Emerald Green
          break;
        case 'end':
          color = 0x3b82f6; // Blue
          break;
        case 'wallrun':
          color = 0x8b5cf6; // Purple
          break;
        case 'jump':
          color = 0xf59e0b; // Gold Orange
          break;
        case 'hazard':
          color = 0xef4444; // Red
          break;
        case 'climb':
          color = 0x06b6d4; // Teal lattice
          transparent = true;
          opacity = 0.7;
          break;
        case 'speed':
          color = 0xec4899; // Speed pink
          break;
        case 'checkpoint':
          color = 0x65a30d; // Acid green
          transparent = true;
          opacity = 0.8;
          break;
        case 'glass':
          color = 0x93c5fd; // Ice blue
          transparent = true;
          opacity = 0.55;
          break;
      }

      // Check if selected
      const isSelected = block.id === selectedBlockId;
      
      const geometry = new THREE.BoxGeometry(block.w, block.h, block.d);
      
      const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.15,
        metalness: block.type === 'speed' ? 0.8 : 0.1,
        transparent: transparent || isSelected,
        opacity: isSelected ? 0.7 : opacity,
        emissive: isSelected ? 0xffffff : 0x000000,
        emissiveIntensity: isSelected ? 0.35 : 0.0
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(block.x, block.y + block.h / 2, block.z);
      
      // If selected block, add wireframe helper or outlines
      if (isSelected) {
        const wireframeGeom = new THREE.EdgesGeometry(geometry);
        const wireframeMat = new THREE.LineBasicMaterial({ color: 0xe0e7ff, linewidth: 2 });
        const wireframe = new THREE.LineSegments(wireframeGeom, wireframeMat);
        mesh.add(wireframe);
      }

      scene.add(mesh);
      meshesRef.current[block.id] = mesh;
    });

    // Clear camera target centering from here as it is handled in a dedicated viewport useEffect below
    sceneRef.current = scene;
  }, [blocks, selectedBlockId]);

  // Update camera position & orientation dynamically based on viewport control parameters
  useEffect(() => {
    if (!cameraRef.current) return;
    
    const active = selectedBlock || blocks[0];
    if (!active) return;

    // Calculate base target with manual pan offsets
    const targetX = active.x + panX;
    const targetY = active.y;
    const targetZ = active.z + panZ;

    // Orbit coordinates around target using cameraRotation & cameraZoom
    const angleRad = (cameraRotation * Math.PI) / 180;
    
    cameraRef.current.position.set(
      targetX + Math.sin(angleRad) * cameraZoom,
      targetY + cameraHeight,
      targetZ + Math.cos(angleRad) * cameraZoom
    );
    
    cameraRef.current.lookAt(targetX, targetY, targetZ);
  }, [blocks, selectedBlockId, cameraZoom, cameraRotation, cameraHeight, panX, panZ, selectedBlock]);

  const MAX_BLOCKS = 200;

  const handleAddBlock = (type: BlockType) => {
    if (blocks.length >= MAX_BLOCKS) {
      alert(`Course element limit reached (${MAX_BLOCKS} max). Delete some elements before adding more.`);
      return;
    }
    // Determine random offset relative to last selected coordinate to make stacking quick
    const lastBlock = selectedBlock || blocks[blocks.length - 1];
    const newId = `block_${Date.now()}`;
    const newBlock: BlockConfig = {
      id: newId,
      type: type,
      x: lastBlock ? lastBlock.x : 0,
      y: lastBlock ? lastBlock.y + lastBlock.h : 2,
      z: lastBlock ? lastBlock.z - 10 : -10,
      w: type === 'wallrun' ? 1 : 4,
      h: type === 'wallrun' ? 6 : 1,
      d: type === 'climb' ? 1 : 4,
    };

    setBlocks([...blocks, newBlock]);
    setSelectedBlockId(newId);
  };

  const handleDeleteBlock = (id: string) => {
    const block = blocks.find(b => b.id === id);
    if (id === 'start_pad' || block?.type === 'start') {
      alert('You cannot delete the starting spawn pad.');
      return;
    }
    if (id === 'end_pad' || block?.type === 'end') {
      alert('You cannot delete the end pad.');
      return;
    }
    const filtered = blocks.filter(b => b.id !== id);
    setBlocks(filtered);
    if (selectedBlockId === id) {
      setSelectedBlockId('start_pad');
    }
  };

  const updateSelectedBlock = (updated: Partial<BlockConfig>) => {
    if (!selectedBlockId) return;
    setBlocks(blocks.map(b => b.id === selectedBlockId ? { ...b, ...updated } as BlockConfig : b));
  };

  const handleSave = () => {
    if (hasVulgarLanguage(levelName)) {
      alert('Explicit or vulgar language is prohibited.');
      return;
    }

    // Validate levels must have start and end pad
    const hasStart = blocks.some(b => b.type === 'start');
    const hasEnd = blocks.some(b => b.type === 'end');

    if (!hasStart || !hasEnd) {
      alert('Your course must include at least one START pad and one END pad.');
      return;
    }

    // Generate a unique ID if this is a blank layout or still has the draft placeholder ID
    const isNewDraft = !initialLevel?.id || initialLevel.id === 'momentum_builder_draft_temp_id';
    const finalId = isNewDraft ? `level_${Date.now()}` : initialLevel.id;

    const compiled: LevelConfig = {
      id: finalId,
      name: levelName.trim() || 'Custom course',
      description: levelDesc.trim(),
      theme: theme,
      blocks: blocks,
      isCustom: true
    };

    onSave(compiled);
  };

  const handleTestLevel = () => {
    if (hasVulgarLanguage(levelName)) {
      alert('Explicit or vulgar language is prohibited.');
      return;
    }

    const compiled: LevelConfig = {
      id: 'test_level_active',
      name: levelName.trim() || 'Course Test Run',
      description: levelDesc.trim(),
      theme: theme,
      blocks: blocks,
      isCustom: true
    };
    onTest(compiled);
  };

  const handleExit = () => {
    if (hasVulgarLanguage(levelName)) {
      alert('Explicit or vulgar language is prohibited.');
      return;
    }

    const compiled: LevelConfig = {
      id: initialLevel?.id || `level_${Date.now()}`,
      name: levelName.trim() || 'Custom course',
      description: levelDesc.trim(),
      theme: theme,
      blocks: blocks,
      isCustom: true
    };
    onExit(compiled);
  };

  return (
    <div className="flex flex-col lg:flex-row h-[90vh] bg-neutral-950 font-sans">
      
      {/* 3D Visualizer Panel (Left or top) */}
      <div className="flex-1 relative h-2/5 lg:h-full flex flex-col border-b lg:border-b-0 lg:border-r border-neutral-800">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full block cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        />
        
        {/* Sleek, minimal floating viewport tools */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20 select-none">
          {/* Zoom & View Reset controls */}
          <div className="flex items-center gap-1.5 p-1.5 bg-neutral-900/95 border border-neutral-800 rounded-xl backdrop-blur shadow-xl">
            <button
              onClick={() => setCameraZoom(prev => Math.max(5, prev - 5))}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-200 hover:text-indigo-400 rounded-lg transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCameraZoom(prev => Math.min(120, prev + 5))}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-200 hover:text-indigo-400 rounded-lg transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-neutral-800 mx-0.5" />
            <button
              onClick={handleResetCamera}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 hover:text-white rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>

          {/* Guidance helper */}
          <div className="px-3 py-1.5 bg-neutral-950/80 border border-neutral-900/60 text-[9px] font-mono text-neutral-400 rounded-full shadow-lg backdrop-blur pointer-events-none max-w-xs leading-none">
            Drag to Orbit • Shift+Drag to Pan • Scroll to Zoom
          </div>
        </div>

        {/* Hot keys actions overlay */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          <button
            onClick={handleTestLevel}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Instant Test Run
          </button>
        </div>
      </div>

      {/* Toolbox Panel (Right / Controls) */}
      <div className="w-full lg:w-[420px] bg-neutral-900 overflow-y-auto p-6 flex flex-col justify-between max-h-3/5 lg:max-h-full border-neutral-800">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <button onClick={handleExit} className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-bold text-neutral-50 uppercase tracking-widest font-mono">Course Builder</h2>
            </div>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Layout
            </button>
          </div>

          {/* Level Details form fields */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-mono text-neutral-400 uppercase">Course Title</label>
              <input
                type="text"
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
                placeholder="Level Title"
                className="w-full mt-1.5 p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:border-indigo-500 focus:outline-none"
              />
              {hasVulgarLanguage(levelName) && (
                <p className="text-rose-500 text-[10px] mt-1 pl-0.5">
                  Explicit or vulgar language is prohibited.
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between">
                <label className="block text-[10px] font-mono text-neutral-400 uppercase">Atmospheric Theme</label>
              </div>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as SceneTheme)}
                className="w-full mt-1.5 p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:border-indigo-500 focus:outline-none"
              >
                <option value="sky_islands">Sky Islands (Cloud daylight)</option>
                <option value="neon_grid">Neon Vector Grid (Synthwave purple)</option>
                <option value="industrial_rust">Industrial Rust (Lava smoggy theme)</option>
                <option value="mountain_sunset">Mountain Sunset (Vibrant orange theme)</option>
                <option value="abstract_white">Abstract Geometry (High-contrast gray)</option>
              </select>
            </div>
          </div>

          {/* Construction Toolbox */}
          <div className="pb-3 border-b border-neutral-800">
            <h3 className="text-[10px] font-mono text-neutral-400 uppercase mb-3">Add Core Handrails / Plates</h3>
            {blocks.length >= MAX_BLOCKS && (
              <p className="text-[10px] font-mono text-red-400 mb-2">Element limit reached ({MAX_BLOCKS} max). Delete elements to add more.</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => handleAddBlock('normal')}
                disabled={blocks.length >= MAX_BLOCKS}
                className="py-2 px-2.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-semibold text-xs rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Normal Plat
              </button>
              <button
                onClick={() => handleAddBlock('wallrun')}
                disabled={blocks.length >= MAX_BLOCKS}
                className="py-2 px-2.5 bg-purple-950/30 hover:bg-purple-950/50 border border-purple-800/30 text-purple-300 font-semibold text-xs rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Wall Run
              </button>
              <button
                onClick={() => handleAddBlock('jump')}
                disabled={blocks.length >= MAX_BLOCKS}
                className="py-2 px-2.5 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-800/30 text-amber-300 font-semibold text-xs rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Jump Pad
              </button>
              <button
                onClick={() => handleAddBlock('checkpoint')}
                disabled={blocks.length >= MAX_BLOCKS}
                className="py-2 px-2.5 bg-lime-950/30 hover:bg-lime-950/50 border border-lime-800/30 text-lime-300 font-semibold text-xs rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Checkpoint
              </button>
              <button
                onClick={() => handleAddBlock('climb')}
                disabled={blocks.length >= MAX_BLOCKS}
                className="py-2 px-2.5 bg-cyan-950/30 hover:bg-cyan-950/50 border border-cyan-800/30 text-cyan-300 font-semibold text-xs rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Ladder/Gate
              </button>
              <button
                onClick={() => handleAddBlock('speed')}
                disabled={blocks.length >= MAX_BLOCKS}
                className="py-2 px-2.5 bg-pink-950/30 hover:bg-pink-950/50 border border-pink-800/30 text-pink-300 font-semibold text-xs rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Speed Boost
              </button>
              <button
                onClick={() => handleAddBlock('hazard')}
                disabled={blocks.length >= MAX_BLOCKS}
                className="py-2 px-2.5 bg-red-950/30 hover:bg-red-950/50 border border-red-800/30 text-red-300 font-semibold text-xs rounded-lg transition col-span-2 sm:col-span-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Lava/Hazard
              </button>
            </div>
          </div>

          {/* Block Coordinates Hierarchy */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-mono text-neutral-400 uppercase">
                Course Elements List ({blocks.length}/{MAX_BLOCKS}
                {blocks.length >= MAX_BLOCKS && <span className="text-red-400 ml-1">— limit reached</span>})
              </h3>
              <button
                onClick={() => {
                  setShowResetConfirm(true);
                }}
                className="text-[10px] text-red-400 hover:text-red-300 transition font-mono hover:underline cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Reset Layout</span>
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1 bg-neutral-950/40 p-2 rounded-xl border border-neutral-800/60">
              {blocks.map(b => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBlockId(b.id)}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition ${
                    b.id === selectedBlockId
                      ? 'bg-neutral-800 border-indigo-500'
                      : 'bg-neutral-900 border-neutral-950 hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono">
                    <span className={`w-2.5 h-2.5 rounded ${
                      b.type === 'start' ? 'bg-emerald-500' :
                      b.type === 'end' ? 'bg-blue-500' :
                      b.type === 'hazard' ? 'bg-red-500' :
                      b.type === 'wallrun' ? 'bg-purple-500' :
                      b.type === 'jump' ? 'bg-amber-500' :
                      b.type === 'speed' ? 'bg-pink-500' :
                      b.type === 'checkpoint' ? 'bg-lime-500' :
                      b.type === 'climb' ? 'bg-cyan-500' :
                      b.type === 'glass' ? 'bg-sky-300' : 'bg-neutral-500'
                    }`} />
                    <span className="text-neutral-300">
                      {b.type === 'climb' ? 'Ladder Block' : 
                       b.type === 'wallrun' ? 'Wallrun Block' :
                       b.type === 'checkpoint' ? 'Checkpoint Block' :
                       b.type === 'speed' ? 'Speed Block' :
                       b.type === 'hazard' ? 'Hazard Block' :
                       b.type === 'glass' ? 'Glass Block' :
                       b.type.charAt(0).toUpperCase() + b.type.slice(1) + ' Block'}
                    </span>
                    <span className="text-[10px] text-neutral-500">({b.x},{b.y},{b.z})</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBlock(b.id);
                    }}
                    className="text-neutral-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Transform selected Block */}
          {selectedBlock && (
            <div className="mt-6 p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-neutral-800/80">
                <span className="text-xs font-bold font-mono text-neutral-300 uppercase">Transforming: {selectedBlock.type}</span>
                <span className="text-[10px] text-neutral-500 font-mono">ID: {selectedBlock.id.substring(0, 8)}</span>
              </div>

              {/* Offset X Slider (Horizontal Left-Right) */}
              <div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-neutral-400">Position X (Shift Left/Right)</span>
                  <span className="text-neutral-200">{selectedBlock.x}m</span>
                </div>
                <div className="flex gap-2 mt-1">
                  <input
                    type="range"
                    min="-80"
                    max="80"
                    step="1"
                    value={selectedBlock.x}
                    onChange={(e) => updateSelectedBlock({ x: parseInt(e.target.value) })}
                    className="flex-1 accent-indigo-500"
                  />
                  <div className="flex gap-1">
                    <button onClick={() => updateSelectedBlock({ x: selectedBlock.x - 1 })} className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-[10px] rounded hover:bg-neutral-800 font-mono">-</button>
                    <button onClick={() => updateSelectedBlock({ x: selectedBlock.x + 1 })} className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-[10px] rounded hover:bg-neutral-800 font-mono">+</button>
                  </div>
                </div>
              </div>

              {/* Height Y Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-neutral-400">Position Y (Elevation Height)</span>
                  <span className="text-neutral-200">{selectedBlock.y}m</span>
                </div>
                <div className="flex gap-2 mt-1">
                  <input
                    type="range"
                    min="-20"
                    max="80"
                    step="1"
                    value={selectedBlock.y}
                    onChange={(e) => updateSelectedBlock({ y: parseInt(e.target.value) })}
                    className="flex-1 accent-indigo-500"
                  />
                  <div className="flex gap-1">
                    <button onClick={() => updateSelectedBlock({ y: selectedBlock.y - 1 })} className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-[10px] rounded hover:bg-neutral-800 font-mono">-</button>
                    <button onClick={() => updateSelectedBlock({ y: selectedBlock.y + 1 })} className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-[10px] rounded hover:bg-neutral-800 font-mono">+</button>
                  </div>
                </div>
              </div>

              {/* Depth Z (Forward Backwards) */}
              <div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-neutral-400">Position Z (Depth / Distance)</span>
                  <span className="text-neutral-200">{selectedBlock.z}m</span>
                </div>
                <div className="flex gap-2 mt-1">
                  <input
                    type="range"
                    min="-400"
                    max="20"
                    step="1"
                    value={selectedBlock.z}
                    onChange={(e) => updateSelectedBlock({ z: parseInt(e.target.value) })}
                    className="flex-1 accent-indigo-500"
                  />
                  <div className="flex gap-1">
                    <button onClick={() => updateSelectedBlock({ z: selectedBlock.z - 2 })} className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-[10px] rounded hover:bg-neutral-800 font-mono">-2</button>
                    <button onClick={() => updateSelectedBlock({ z: selectedBlock.z + 2 })} className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-[10px] rounded hover:bg-neutral-800 font-mono">+2</button>
                  </div>
                </div>
              </div>

              {/* Dimensions Width / Height / Depth */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-mono text-neutral-400 uppercase">Width (W)</label>
                  <input
                    type="number"
                    min="0.5"
                    max="30"
                    step="0.5"
                    value={selectedBlock.w}
                    onChange={(e) => updateSelectedBlock({ w: Math.abs(parseFloat(e.target.value) || 1) })}
                    className="w-full mt-1 p-1.5 bg-neutral-900 border border-neutral-800 rounded text-center text-xs text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-neutral-400 uppercase">Height (H)</label>
                  <input
                    type="number"
                    min="0.2"
                    max="40"
                    step="0.5"
                    value={selectedBlock.h}
                    onChange={(e) => updateSelectedBlock({ h: Math.abs(parseFloat(e.target.value) || 1) })}
                    className="w-full mt-1 p-1.5 bg-neutral-900 border border-neutral-800 rounded text-center text-xs text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-neutral-400 uppercase">Length (D)</label>
                  <input
                    type="number"
                    min="0.5"
                    max="40"
                    step="0.5"
                    value={selectedBlock.d}
                    onChange={(e) => updateSelectedBlock({ d: Math.abs(parseFloat(e.target.value) || 1) })}
                    className="w-full mt-1 p-1.5 bg-neutral-900 border border-neutral-800 rounded text-center text-xs text-neutral-100"
                  />
                </div>
              </div>

              {/* End pad specific details or copy block layout helper */}
              <div className="text-[10px] text-neutral-500 font-mono italic leading-relaxed pt-1">
                Tip: Standard single jumps require platforms to be around 6 to 12 meters apart. Jump pads launch up to 25 meters high!
              </div>

            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="pt-6 border-t border-neutral-800 mt-6 flex justify-between gap-3 text-xs font-mono">
          <p className="text-[10px] text-neutral-500 leading-relaxed self-center uppercase font-bold text-center">
            Zero-Gravity Lab v1.0
          </p>
        </div>

      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative space-y-4 animate-in fade-in duration-200">
            <div className="h-12 w-12 rounded-full bg-red-950/40 border border-red-800/30 flex items-center justify-center text-red-500 mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold text-neutral-100 font-mono uppercase tracking-wider">Reset Course Layout?</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                This will delete all custom elements you have added and reset the course back to only the start and end pads. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2 font-mono text-[11px]">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700/80 border border-neutral-700/50 text-neutral-300 font-semibold rounded-lg transition cursor-pointer"
              >
                No, Keep Layout
              </button>
              <button
                onClick={handleResetCourse}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg shadow-lg shadow-red-600/15 transition cursor-pointer"
              >
                Yes, Reset Layout
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
