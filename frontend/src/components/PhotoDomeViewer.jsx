import React, { useEffect, useRef } from "react";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

const PhotoDomeViewer = ({ imageUrl, mode = "MONOSCOPIC" }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Debug: Component lifecycle
  console.log('🔧 [1] PhotoDomeViewer rendering...');
  console.log('🖼️ [2] Image URL:', imageUrl);
  console.log('🎯 [3] Mode:', mode);

  useEffect(() => {
    console.log('🚀 [4] useEffect started');
    
    if (!canvasRef.current) {
      console.error('❌ [5] Canvas ref is null');
      return;
    }
    
    if (!imageUrl) {
      console.error('❌ [6] No image URL provided');
      return;
    }

    console.log('📐 [7] Container size:', containerRef.current?.getBoundingClientRect());
    console.log('🎨 [8] Canvas size:', canvasRef.current.getBoundingClientRect());

    try {
      console.log('⚙️ [9] Creating Babylon engine...');
      const engine = new BABYLON.Engine(canvasRef.current, true);
      engineRef.current = engine;
      const scene = new BABYLON.Scene(engine);
      sceneRef.current = scene;

      console.log('📷 [10] Creating camera...');
      // Camera with proper configuration for full panoramic view
      const camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 2,     // Alpha - start facing forward
        Math.PI / 2,      // Beta - horizontal view
        2.5,              // Radius - natural distance
        BABYLON.Vector3.Zero(),
        scene
      );
      
      // Camera settings optimized for full panoramic coverage
      camera.minZ = 0.1;
      camera.fov = 1.2;                    // Wider field of view
      camera.lowerBetaLimit = 0.1;         // Prevent looking straight up/down
      camera.upperBetaLimit = Math.PI - 0.1;
      camera.lowerRadiusLimit = 0.5;       // Prevent zooming too close
      camera.upperRadiusLimit = 10;        // Allow some zoom out
      camera.wheelPrecision = 100;         // Smoother zoom
      camera.panningSensibility = 2000;    // Smoother panning
      
      camera.attachControl(canvasRef.current, true);

      console.log('💡 [11] Adding light...');
      // Add ambient light
      new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

      console.log('🌐 [12] Creating PhotoDome...');
      // Create PhotoDome with optimized settings for full coverage
      const dome = new BABYLON.PhotoDome(
        "property-dome",
        imageUrl,
        { 
          resolution: 96,           // Higher resolution for better quality
          size: 1000,              // Large size to ensure full coverage
          useDirectMapping: false,  // Use spherical mapping for 360 images
        },
        scene
      );

      // Add dome event listeners for debugging
      dome.onLoadError = (errorMsg) => {
        console.error('❌ [13] PhotoDome load error:', errorMsg);
      };

      dome.onLoadObservable.add(() => {
        console.log('✅ [14] PhotoDome loaded successfully!');
        console.log('📏 [15] Dome fovMultiplier:', dome.fovMultiplier);
        console.log('🔄 [16] Dome imageMode:', dome.imageMode);
      });

      // Set image mode
      console.log('🎭 [17] Setting image mode:', mode);
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

      // CRITICAL FIX: Show full image
      console.log('🎛️ [18] Setting fovMultiplier to 1.0');
      dome.fovMultiplier = 1.0;

      // Handle window resize
      const handleResize = () => {
        console.log('📱 [19] Window resized, resizing engine');
        engine.resize();
      };

      // Listen for fullscreen changes
      const handleFullscreenChange = () => {
        const fullscreen = !!document.fullscreenElement;
        console.log('🖥️ [20] Fullscreen changed:', fullscreen);
        setIsFullscreen(fullscreen);
        // Resize engine when fullscreen changes
        setTimeout(() => {
          console.log('📐 [21] Resizing engine after fullscreen change');
          engine.resize();
        }, 100);
      };

      window.addEventListener("resize", handleResize);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('msfullscreenchange', handleFullscreenChange);

      console.log('🔄 [22] Starting render loop...');
      engine.runRenderLoop(() => {
        scene.render();
      });

      console.log('✅ [23] PhotoDomeViewer setup complete');

    } catch (error) {
      console.error('💥 [24] Setup error:', error);
    }

    return () => {
      console.log('🧹 [25] Cleaning up PhotoDomeViewer...');
      window.removeEventListener("resize", handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      
      if (sceneRef.current) {
        console.log('🗑️ [26] Disposing scene');
        sceneRef.current.dispose();
      }
      if (engineRef.current) {
        console.log('🗑️ [27] Disposing engine');
        engineRef.current.dispose();
      }
    };
  }, [imageUrl, mode]);

  // Enhanced mobile-friendly fullscreen
  const handleExpand = async () => {
    console.log('📱 [28] Expand button clicked, isFullscreen:', isFullscreen);
    
    if (!containerRef.current) {
      console.error('❌ [29] Container ref is null');
      return;
    }

    try {
      if (document.fullscreenElement) {
        console.log('🚪 [30] Exiting fullscreen...');
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      } else {
        console.log('🔄 [31] Entering fullscreen...');
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
      }
      console.log('✅ [32] Fullscreen operation completed');
    } catch (err) {
      console.error('❌ [33] Fullscreen error:', err);
      // Fallback for browsers that don't support fullscreen API
      setIsFullscreen(!isFullscreen);
    }
  };

  // Mobile detection
  const isMobile = () => {
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('📱 [34] Mobile detection:', mobile);
    return mobile;
  };

  // Handle orientation change for mobile
  useEffect(() => {
    const handleOrientationChange = () => {
      console.log('🔄 [35] Orientation changed');
      if (engineRef.current) {
        setTimeout(() => {
          console.log('📐 [36] Resizing engine after orientation change');
          engineRef.current.resize();
        }, 300);
      }
    };

    console.log('🎯 [37] Adding orientation change listener');
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      console.log('🧹 [38] Removing orientation change listener');
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  console.log('🎨 [39] Rendering JSX, isFullscreen:', isFullscreen);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'relative', 
        background: '#000', 
        borderRadius: isFullscreen ? 0 : '12px', 
        width: '100%', 
        height: isFullscreen ? '100vh' : '400px', 
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
          touchAction: 'none'
        }}
      />
      
      {/* Mobile-optimized Expand Button */}
      <button
        onClick={handleExpand}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 1000,
          background: 'rgba(30, 41, 59, 0.9)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: isMobile() ? '12px 16px' : '8px 16px',
          fontSize: isMobile() ? '16px' : '14px',
          fontWeight: '600',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          minWidth: isMobile() ? '60px' : 'auto',
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
          e.target.style.background = 'rgba(15, 23, 42, 0.95)';
        }}
        onTouchEnd={(e) => {
          e.target.style.background = 'rgba(30, 41, 59, 0.9)';
        }}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? 'Close' : 'Expand'}
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