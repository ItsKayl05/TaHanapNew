import React, { useEffect, useRef } from "react";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

const PhotoDomeViewer = ({ imageUrl, mode = "MONOSCOPIC" }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const closeBtnRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Mobile detection with better accuracy
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  };

  useEffect(() => {
    if (!canvasRef.current || !imageUrl) return;

    // Declare event handlers at the top level of useEffect
    const handleResize = () => {
      if (engineRef.current) {
        engineRef.current.resize();
      }
    };

    const handleFullscreenChange = () => {
      const fullscreen = !!document.fullscreenElement || 
                        !!document.webkitFullscreenElement ||
                        !!document.mozFullScreenElement ||
                        !!document.msFullscreenElement;
      setIsFullscreen(fullscreen);
      
      // Resize engine when fullscreen changes
      setTimeout(() => {
        if (engineRef.current) {
          engineRef.current.resize();
        }
      }, 300);
    };

    try {
      const engine = new BABYLON.Engine(canvasRef.current, true);
      engineRef.current = engine;
      const scene = new BABYLON.Scene(engine);
      sceneRef.current = scene;

      // Camera with proper configuration for full panoramic view
      const camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 2,     // Alpha - start facing forward
        Math.PI / 2,      // Beta - horizontal view
        2.5,              // Radius - natural distance
        BABYLON.Vector3.Zero(),
        scene
      );
      
      // Camera settings optimized for mobile
      camera.minZ = 0.1;
      camera.fov = 1.2;
      camera.lowerBetaLimit = 0.1;
      camera.upperBetaLimit = Math.PI - 0.1;
      camera.lowerRadiusLimit = 0.5;
      camera.upperRadiusLimit = 10;
      camera.wheelPrecision = isMobile() ? 150 : 100;
      camera.panningSensibility = isMobile() ? 3000 : 2000;
      
      camera.attachControl(canvasRef.current, true);

      // Add ambient light
      new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

      // Create PhotoDome with optimized settings
      const dome = new BABYLON.PhotoDome(
        "property-dome",
        imageUrl,
        { 
          resolution: isMobile() ? 64 : 96,
          size: 1000,
          useDirectMapping: false,
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

      // Show full image
      dome.fovMultiplier = 1.0;

      // Add event listeners
      window.addEventListener("resize", handleResize);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('MSFullscreenChange', handleFullscreenChange);

      engine.runRenderLoop(() => {
        scene.render();
      });

    } catch (error) {
      console.error('PhotoDomeViewer setup error:', error);
    }

    return () => {
      // Remove event listeners
      window.removeEventListener("resize", handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      
      // Cleanup Babylon.js resources
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
      if (engineRef.current) {
        engineRef.current.dispose();
      }
      
      engineRef.current = null;
      sceneRef.current = null;
    };
  }, [imageUrl, mode]);

  // Enhanced mobile-friendly fullscreen with better close button handling
  const handleExpand = async () => {
    if (!containerRef.current) return;

    const element = containerRef.current;

    try {
      if (isFullscreen) {
        // Exit fullscreen
        await exitFullscreen();
      } else {
        // Enter fullscreen
        await enterFullscreen(element);
      }
    } catch (err) {
      console.log('Fullscreen error:', err);
      // Fallback for mobile
      handleMobileFallbackFullscreen();
    }
  };

  const exitFullscreen = async () => {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      await document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      await document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      await document.msExitFullscreen();
    }
    setIsFullscreen(false);
  };

  const enterFullscreen = async (element) => {
    const requestFullscreen = 
      element.requestFullscreen ||
      element.webkitRequestFullscreen ||
      element.mozRequestFullScreen ||
      element.msRequestFullscreen;

    if (requestFullscreen) {
      await requestFullscreen.call(element);
    } else {
      throw new Error('Fullscreen not supported');
    }
  };

  const handleMobileFallbackFullscreen = () => {
    const element = containerRef.current;
    if (!element) return;

    if (!isFullscreen) {
      // Enter custom fullscreen
      element.style.position = 'fixed';
      element.style.top = '0';
      element.style.left = '0';
      element.style.width = '100vw';
      element.style.height = '100vh';
      element.style.zIndex = '9999';
      element.style.background = '#000';
      setIsFullscreen(true);
      
      // Remove any existing close button first
      const existingCloseBtn = element.querySelector('.custom-close-btn');
      if (existingCloseBtn) {
        existingCloseBtn.remove();
      }
      
      // Add close button for custom fullscreen - FIXED VERSION
      const closeBtn = document.createElement('button');
      closeBtn.className = 'custom-close-btn';
      closeBtn.innerHTML = '✕';
      closeBtn.style.position = 'fixed'; // Changed to fixed
      closeBtn.style.top = '20px';
      closeBtn.style.right = '20px';
      closeBtn.style.zIndex = '10001'; // Higher z-index
      closeBtn.style.background = 'rgba(0,0,0,0.8)';
      closeBtn.style.color = 'white';
      closeBtn.style.border = '2px solid rgba(255,255,255,0.5)';
      closeBtn.style.borderRadius = '50%';
      closeBtn.style.width = '50px';
      closeBtn.style.height = '50px';
      closeBtn.style.fontSize = '24px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.display = 'flex';
      closeBtn.style.alignItems = 'center';
      closeBtn.style.justifyContent = 'center';
      closeBtn.style.WebkitTapHighlightColor = 'transparent';
      closeBtn.style.userSelect = 'none';
      closeBtn.style.pointerEvents = 'auto';
      
      // Add to body instead of container to avoid z-index issues
      document.body.appendChild(closeBtn);
      
      // Store reference for cleanup
      closeBtnRef.current = closeBtn;
      
      // Enhanced click handler
      const handleClose = () => {
        element.style.position = '';
        element.style.top = '';
        element.style.left = '';
        element.style.width = '';
        element.style.height = '';
        element.style.zIndex = '';
        element.style.background = '';
        
        if (closeBtnRef.current) {
          closeBtnRef.current.remove();
          closeBtnRef.current = null;
        }
        
        setIsFullscreen(false);
        
        // Remove event listeners
        closeBtn.removeEventListener('click', handleClose);
        document.removeEventListener('touchstart', handleOutsideTouch);
      };
      
      const handleOutsideTouch = (e) => {
        // Close when tapping outside (optional)
        if (!element.contains(e.target) && !closeBtn.contains(e.target)) {
          handleClose();
        }
      };
      
      closeBtn.addEventListener('click', handleClose, { once: true });
      document.addEventListener('touchstart', handleOutsideTouch, { once: true });
      
    } else {
      // Exit custom fullscreen
      element.style.position = '';
      element.style.top = '';
      element.style.left = '';
      element.style.width = '';
      element.style.height = '';
      element.style.zIndex = '';
      element.style.background = '';
      
      if (closeBtnRef.current) {
        closeBtnRef.current.remove();
        closeBtnRef.current = null;
      }
      
      setIsFullscreen(false);
    }
  };

  // Cleanup close button on unmount
  useEffect(() => {
    return () => {
      if (closeBtnRef.current) {
        closeBtnRef.current.remove();
        closeBtnRef.current = null;
      }
    };
  }, []);

  // Handle orientation change for mobile
  useEffect(() => {
    const handleOrientationChange = () => {
      if (engineRef.current) {
        setTimeout(() => {
          engineRef.current.resize();
        }, 500);
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

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
          touchAction: isMobile() ? 'pan-x pan-y' : 'none',
          pointerEvents: 'auto'
        }}
      />
      
      {/* Enhanced Expand Button for Mobile */}
      <button
        onClick={handleExpand}
        style={{
          position: 'absolute',
          top: isMobile() ? '16px' : '12px',
          right: isMobile() ? '16px' : '12px',
          zIndex: 1000,
          background: 'rgba(30, 41, 59, 0.95)',
          color: '#fff',
          border: 'none',
          borderRadius: isMobile() ? '12px' : '8px',
          padding: isMobile() ? '14px 18px' : '8px 16px',
          fontSize: isMobile() ? '18px' : '14px',
          fontWeight: '600',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          minWidth: isMobile() ? '70px' : 'auto',
          minHeight: isMobile() ? '50px' : 'auto',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          pointerEvents: 'auto'
        }}
        onTouchStart={(e) => {
          e.currentTarget.style.background = 'rgba(15, 23, 42, 0.95)';
          e.currentTarget.style.transform = 'scale(0.95)';
        }}
        onTouchEnd={(e) => {
          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.95)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? (isMobile() ? 'Close' : 'Close') : (isMobile() ? 'Full' : 'Expand')}
      </button>

      {/* Enhanced Mobile Instructions */}
      {isMobile() && !isFullscreen && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          right: '16px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '12px',
          fontSize: '14px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          pointerEvents: 'none'
        }}>
          👆 Drag to look around • Tap <strong>Full</strong> for fullscreen
        </div>
      )}
    </div>
  );
};

export default PhotoDomeViewer;