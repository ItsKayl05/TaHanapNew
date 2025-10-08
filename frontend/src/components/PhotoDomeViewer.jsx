import React, { useEffect, useRef } from "react";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

const PhotoDomeViewer = ({ imageUrl, mode = "MONOSCOPIC" }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const resizeCanvasRef = useRef(null); // exposed resize function for use by handlers
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  useEffect(() => {
    if (!canvasRef.current || !imageUrl) return;

    // Create engine using the canvas element
    const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true });
    engineRef.current = engine;
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;

    // Camera with proper configuration for full panoramic view
    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 2,  // Start from front view
      Math.PI / 2,   // Horizontal view
      3,             // Distance from center
      BABYLON.Vector3.Zero(),
      scene
    );
    
    // Camera settings for full panoramic experience
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = Math.PI - 0.1;
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 10;
    camera.wheelPrecision = 50;
    camera.panningSensibility = 1000;
    
    camera.attachControl(canvasRef.current, true);

    // Light
    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // PhotoDome with optimized settings
    const dome = new BABYLON.PhotoDome(
      "property-dome",
      imageUrl,
      { 
        resolution: 64,
        size: 1000,
        useDirectMapping: false
      },
      scene
    );

    // Set image mode
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

    // Optimize FOV for full view
    dome.fovMultiplier = 0.8;

    // Utility: ensure canvas pixel buffer matches CSS size and DPR
    const resizeCanvas = () => {
      try {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !engine || !container) return;

        // Prefer clientWidth/clientHeight which are more stable when the element
        // is inside transformed/animated parents. Fall back to getBoundingClientRect.
        const rect = container.getBoundingClientRect();
        let cssWidth = Math.max(1, container.clientWidth || Math.round(rect.width));
        let cssHeight = Math.max(1, container.clientHeight || Math.round(rect.height));

        // If we're in the fullscreen fallback or actual fullscreen and the
        // computed container height is unexpectedly small (some mobile browsers
        // report 0 or small values briefly), use the viewport height as a fallback.
        const inFallback = container.classList && container.classList.contains('photo-dome-fullscreen-fallback');
        const inFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
        const viewportHeight = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
        if ((inFallback || inFullscreen) && cssHeight < Math.round(viewportHeight * 0.8)) {
          cssHeight = Math.max(cssHeight, Math.round(viewportHeight));
        }

        // Apply explicit pixel CSS sizes to the canvas to avoid percentage rounding issues
        canvas.style.width = cssWidth + 'px';
        canvas.style.height = cssHeight + 'px';

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(cssWidth * dpr));
  const h = Math.max(1, Math.round(cssHeight * dpr));

        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }

        // Ensure CSS width/height remain in sync with computed values
        canvas.style.width = cssWidth + 'px';
        canvas.style.height = cssHeight + 'px';

        // Make sure the engine sees the updated size (call multiple times briefly
        // to handle weird mobile layout timing and delayed CSS transitions when
        // toggling the fallback full-screen class).
        try { engine.resize(); } catch (e) { /* ignore engine resize errors */ }
        setTimeout(() => { try { engine.resize(); } catch (e) {} }, 60);
        // Extra safeguard: schedule another resize a bit later for slow mobile
        // layout passes (helps avoid the 'half-black' render in screenshots).
        setTimeout(() => { try { engine.resize(); } catch (e) {} }, 300);
      } catch (err) {
        // swallow
      }
    };
    // expose for use in fullscreen/orientation handlers outside this effect
    resizeCanvasRef.current = resizeCanvas;

    // Use ResizeObserver to detect container size changes (more reliable than window resize alone)
    if (window.ResizeObserver && containerRef.current) {
      try {
        resizeObserverRef.current = new ResizeObserver(resizeCanvas);
        resizeObserverRef.current.observe(containerRef.current);
      } catch (err) {
        // ignore if ResizeObserver not available or throws
      }
    }

    // Preload image so we can force a resize after the image's natural dimensions are available
    // This helps avoid cases where the renderer only draws into a portion of the canvas
    try {
      const preloadImg = new Image();
      preloadImg.crossOrigin = 'anonymous';
      preloadImg.onload = () => {
        // ensure the canvas is sized to the final container size after image loads
        resizeCanvas();
        try { engine.resize(); } catch (e) { /* ignore */ }
      };
      preloadImg.src = imageUrl;
    } catch (err) {
      // ignore preload errors
    }

  // Handle window resize and other visual changes
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);
  document.addEventListener('fullscreenchange', resizeCanvas);
  document.addEventListener('webkitfullscreenchange', resizeCanvas);
  document.addEventListener('msfullscreenchange', resizeCanvas);

  // Run render loop and ensure correct initial sizing
  resizeCanvas();
  // slight delay to ensure layout stabilizes on some mobile browsers
  setTimeout(() => { resizeCanvas(); }, 120);
  engine.runRenderLoop(() => scene.render());

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener('orientationchange', resizeCanvas);
      document.removeEventListener('fullscreenchange', resizeCanvas);
      document.removeEventListener('webkitfullscreenchange', resizeCanvas);
      document.removeEventListener('msfullscreenchange', resizeCanvas);
      if (resizeObserverRef.current) {
        try { resizeObserverRef.current.disconnect(); } catch (e) {}
        resizeObserverRef.current = null;
      }
      resizeCanvasRef.current = null;
      try {
        if (sceneRef.current) {
          sceneRef.current.dispose();
        }
        if (engineRef.current) {
          engineRef.current.dispose();
        }
      } catch (err) {
        // ignore dispose errors
      }
    };
  }, [imageUrl, mode]);

  // Enhanced fullscreen functionality for mobile
  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (document.fullscreenElement) {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
        // ensure fallback classes are removed
        try { document.body.classList.remove('no-scroll'); } catch(e){}
        if (containerRef.current.classList.contains('photo-dome-fullscreen-fallback')) {
          containerRef.current.classList.remove('photo-dome-fullscreen-fallback');
        }
      } else {
        // Enter fullscreen
        const element = containerRef.current;
        
          if (element.requestFullscreen) {
            await element.requestFullscreen();
          } else if (element.webkitRequestFullscreen) {
            await element.webkitRequestFullscreen();
          } else if (element.msRequestFullscreen) {
            await element.msRequestFullscreen();
          } else if (element.webkitEnterFullscreen) { // iOS Safari
            element.webkitEnterFullscreen();
          }

          // Some mobile browsers don't actually enter Fullscreen even if the promise resolves.
          // Check shortly after attempting to enter fullscreen; if not in fullscreen, apply fallback.
          setTimeout(() => {
            const isNowFullscreen = !!document.fullscreenElement || !!document.webkitFullscreenElement || !!document.msFullscreenElement;
            if (!isNowFullscreen) {
              // apply fallback
              try { element.classList.add('photo-dome-fullscreen-fallback'); } catch(e){}
              try { document.body.classList.add('no-scroll'); } catch(e){}
              setIsFullscreen(true);
              // force resize after layout changes
              setTimeout(() => { try { if (resizeCanvasRef.current) resizeCanvasRef.current(); } catch(e){} }, 80);
            }
          }, 250);
      }
    } catch (err) {
      console.log(`Fullscreen error: ${err.message}`);
      // Fallback: Toggle mobile-friendly fullscreen mode
      const fallbackEl = containerRef.current;
      if (!fallbackEl) return;

      // Toggle a class that applies fixed positioning to mimic fullscreen on mobile
      const willEnter = !fallbackEl.classList.contains('photo-dome-fullscreen-fallback');
      if (willEnter) {
        fallbackEl.classList.add('photo-dome-fullscreen-fallback');
        try { document.body.classList.add('no-scroll'); } catch(e){}
      } else {
        fallbackEl.classList.remove('photo-dome-fullscreen-fallback');
        try { document.body.classList.remove('no-scroll'); } catch(e){}
      }
      setIsFullscreen(willEnter);

      // After toggling, call the resize method (if available) to force the engine to fit
      setTimeout(() => {
        try { if (resizeCanvasRef.current) resizeCanvasRef.current(); } catch(e){}
      }, 80);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    // Standard events
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle orientation change for mobile
  useEffect(() => {
    const handleOrientationChange = () => {
      // Re-render on orientation change
      if (engineRef.current) {
        setTimeout(() => {
          engineRef.current.resize();
        }, 300);
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Mobile detection
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'relative', 
        background: '#000', 
        borderRadius: isFullscreen ? 0 : '12px', 
        width: '100%', 
        // Only set an explicit height when we're in fullscreen mode.
        // For the normal (non-fullscreen) state we rely on CSS (.photo-dome-container)
        // and the parent wrapper so we don't force a fixed mobile layout.
        ...(isFullscreen ? { height: '100vh' } : {}),
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}
      className="photo-dome-container"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: '#000',
          outline: 'none',
          touchAction: 'none' // Important for mobile touch controls
        }}
      />
      
      {/* Enhanced Expand Button - Mobile Friendly */}
      <button
        onClick={handleFullscreen}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 1000,
          background: 'rgba(30, 41, 59, 0.9)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: isMobile() ? '12px 16px' : '8px 16px', // Larger touch target on mobile
          fontSize: isMobile() ? '16px' : '14px',
          fontWeight: '600',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          minWidth: isMobile() ? '60px' : 'auto', // Better touch target
          minHeight: isMobile() ? '44px' : 'auto'
        }}
        onMouseOver={(e) => {
          if (!isMobile()) {
            e.target.style.background = 'rgba(15, 23, 42, 0.95)';
            e.target.style.transform = 'scale(1.05)';
          }
        }}
        onMouseOut={(e) => {
          if (!isMobile()) {
            e.target.style.background = 'rgba(30, 41, 59, 0.9)';
            e.target.style.transform = 'scale(1)';
          }
        }}
        onTouchStart={(e) => {
          // Visual feedback for mobile touch
          e.target.style.background = 'rgba(15, 23, 42, 0.95)';
        }}
        onTouchEnd={(e) => {
          e.target.style.background = 'rgba(30, 41, 59, 0.9)';
        }}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        className="expand-button"
      >
        {isFullscreen ? 'Exit' : 'Expand'}
      </button>

      {/* Mobile Instructions */}
      {isMobile() && !isFullscreen && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          right: '12px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          👆 Drag to look around • Tap Expand for fullscreen
        </div>
      )}
    </div>
  );
};

export default PhotoDomeViewer;