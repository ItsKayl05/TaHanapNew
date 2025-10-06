import React, { useEffect, useRef } from "react";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

const PhotoDomeViewer = ({ imageUrl, mode = "MONOSCOPIC" }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !imageUrl) return;

    const engine = new BABYLON.Engine(canvasRef.current, true);
    const scene = new BABYLON.Scene(engine);

    // Fullscreen state
    const isFullscreen = () => !!document.fullscreenElement && document.fullscreenElement === containerRef.current;

    // Camera
    // Use a larger radius for fullscreen for a more natural view
    const getInitialRadius = () => {
      if (isFullscreen()) return 2.5; // Fullscreen: natural distance
      return 2.5; // Default: same as before
    };
    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      Math.PI / 2,
      Math.PI / 2,
      getInitialRadius(),
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.attachControl(canvasRef.current, true);

    // Light
    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);

    // PhotoDome
    const dome = new BABYLON.PhotoDome(
      "property-dome",
      imageUrl,
      { resolution: 32, size: 1000, useDirectMapping: true },
      scene
    );

    // Switch mode based on prop
    switch (mode) {
      case "SIDEBYSIDE":
        dome.imageMode = BABYLON.PhotoDome.MODE_SIDEBYSIDE;
        break;
      case "TOPBOTTOM":
        dome.imageMode = BABYLON.PhotoDome.MODE_TOPBOTTOM;
        break;
      default:
        dome.imageMode = BABYLON.PhotoDome.MODE_MONOSCOPIC;
    }

    // FOV/Zoom logic
    let tickCount = -240, zoomLevel = 1;
    scene.registerAfterRender(() => {
      tickCount++;
      if (zoomLevel === 1) {
        if (tickCount >= 0) {
          dome.fovMultiplier = (Math.sin(tickCount / 100) * 0.5) + 1.0;
        }
      } else {
        dome.fovMultiplier = zoomLevel;
      }
    });

    scene.onPointerObservable.add((e) => {
      if (!dome) return;
      if (e.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
        zoomLevel += e.event.wheelDelta * -0.0005;
        if (zoomLevel < 0) zoomLevel = 0;
        if (zoomLevel > 2) zoomLevel = 2;
        if (zoomLevel === 1) tickCount = -60;
      }
    }, BABYLON.PointerEventTypes.POINTERWHEEL);

    // Listen for fullscreen changes to adjust camera radius and FOV
    const handleFullscreen = () => {
      if (isFullscreen()) {
        camera.radius = 2.5; // Set to natural view in fullscreen
        // Optionally, adjust FOV multiplier for fullscreen
        dome.fovMultiplier = 1.0;
      } else {
        camera.radius = 2.5;
        dome.fovMultiplier = 1.0;
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreen);

    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());

    return () => {
      dome.dispose();
      engine.dispose();
      document.removeEventListener('fullscreenchange', handleFullscreen);
    };
  }, [imageUrl, mode]);

  // Fullscreen expand
  const handleExpand = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  // Listen for fullscreen change to force rerender (for button text)
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

    return (
  <div ref={containerRef} style={{ position: 'relative', background: '#000', borderRadius: isFullscreen ? 0 : '12px', width: '100%', height: isFullscreen ? '100vh' : '400px', transition: 'border-radius 0.2s', outline: 'none', border: 'none' }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: isFullscreen ? 0 : '12px',
            display: 'block',
            background: '#000',
            transition: 'border-radius 0.2s',
            outline: 'none',
            border: 'none'
          }}
        />
        <button
          onClick={handleExpand}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 1100,
            background: 'rgba(30,41,59,0.85)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1.1rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 2px 12px -4px rgba(0,0,0,0.25)',
            outline: 'none'
          }}
          aria-label={isFullscreen ? 'Close Fullscreen 360 View' : 'Expand 360 View'}
        >
          {isFullscreen ? 'Close' : 'Expand'}
        </button>
      </div>
    );
};

export default PhotoDomeViewer;
