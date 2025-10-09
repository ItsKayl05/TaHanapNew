import React, { useEffect, useRef } from "react";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

const PhotoDomeViewer = ({ imageUrl, mode = "MONOSCOPIC" }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  useEffect(() => {
    if (!canvasRef.current || !imageUrl) return;

    const engine = new BABYLON.Engine(canvasRef.current, true);
    engineRef.current = engine;
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;

    // Create camera with proper configuration for full panoramic view
    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 2,     // Alpha - start facing forward
      Math.PI / 2,      // Beta - horizontal view
      1,                // Radius - distance from center
      BABYLON.Vector3.Zero(),
      scene
    );
    
    // Camera settings optimized for full panoramic coverage
    camera.minZ = 0.1;
    camera.fov = 1.2;                    // Wider field of view
    camera.lowerBetaLimit = 0.1;         // Prevent looking straight up/down
    camera.upperBetaLimit = Math.PI - 0.1;
    camera.lowerRadiusLimit = 0.1;       // Prevent zooming too close
    camera.upperRadiusLimit = 5;         // Allow some zoom out
    camera.wheelPrecision = 80;          // Smoother zoom
    camera.panningSensibility = 1000;    // Smoother panning
    
    camera.attachControl(canvasRef.current, true);

    // Add ambient light
    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

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

    // CRITICAL FIX: Adjust the FOV multiplier to show the entire image
    dome.fovMultiplier = 1.0;  // Changed from 0.8 to 1.0 for full coverage

    // Additional optimization: Ensure the dome material renders properly
    if (dome.material) {
      dome.material.sideOrientation = BABYLON.Material.ClockWiseSideOrientation;
      dome.material.backFaceCulling = false;
    }

    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };

    window.addEventListener("resize", handleResize);
    
    // Run the render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
      if (engineRef.current) {
        engineRef.current.dispose();
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
      }
    } catch (err) {
      console.log(`Fullscreen error: ${err.message}`);
      // Fallback: Toggle mobile-friendly fullscreen mode
      setIsFullscreen(!isFullscreen);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

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
      
      {/* Enhanced Expand Button */}
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