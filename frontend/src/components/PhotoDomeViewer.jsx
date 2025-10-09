import React, { useEffect, useRef } from "react";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

const PhotoDomeViewer = ({ imageUrl, mode = "MONOSCOPIC" }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const closeBtnRef = useRef(null);
  const cameraRef = useRef(null);
  const domeRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [fovLevel, setFovLevel] = React.useState(1.0);
  const [showZoomIndicator, setShowZoomIndicator] = React.useState(false);

  // Mobile detection
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  };

  useEffect(() => {
    if (!canvasRef.current || !imageUrl) return;

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

      // Create camera
      const camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 2,
        Math.PI / 2,
        2.5,
        BABYLON.Vector3.Zero(),
        scene
      );
      
      camera.minZ = 0.1;
      camera.fov = 1.2;
      camera.lowerBetaLimit = 0.1;
      camera.upperBetaLimit = Math.PI - 0.1;
      camera.lowerRadiusLimit = 0.5;
      camera.upperRadiusLimit = 10;
      camera.wheelPrecision = isMobile() ? 50 : 30;
      camera.panningSensibility = isMobile() ? 2000 : 1500;
      
      camera.attachControl(canvasRef.current, true);
      cameraRef.current = camera;

      // Add ambient light
      new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

      // Create PhotoDome
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

      domeRef.current = dome;

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

      // Initial FOV
      dome.fovMultiplier = fovLevel;

      // ZOOM FUNCTIONALITY: Mouse wheel for PC ONLY
      if (!isMobile()) {
        scene.onPointerObservable.add((pointerInfo) => {
          if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
            handleZoom(pointerInfo.event.deltaY);
          }
        });
      }

      // PINCH TO ZOOM for mobile (hidden but functional)
      let initialDistance = 0;
      let isPinching = false;

      scene.onPointerObservable.add((pointerInfo) => {
        if (isMobile()) {
          if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN && pointerInfo.event.pointerType === "touch") {
            if (pointerInfo.event.pointerId === 0) {
              initialDistance = 0;
              isPinching = false;
            }
          }

          if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE && pointerInfo.event.pointerType === "touch") {
            const touches = pointerInfo.event.activeTouches;
            
            if (touches.length === 2) {
              // Two fingers detected - pinch gesture
              const touch1 = touches[0];
              const touch2 = touches[1];
              
              const currentDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) + 
                Math.pow(touch2.clientY - touch1.clientY, 2)
              );

              if (!isPinching) {
                initialDistance = currentDistance;
                isPinching = true;
                setShowZoomIndicator(true);
              } else {
                const delta = currentDistance - initialDistance;
                handlePinchZoom(delta);
                initialDistance = currentDistance;
              }
            } else {
              isPinching = false;
            }
          }

          if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP && pointerInfo.event.pointerType === "touch") {
            // Hide zoom indicator after pinch ends
            setTimeout(() => setShowZoomIndicator(false), 1000);
          }
        }
      });

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
      window.removeEventListener("resize", handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
      if (engineRef.current) {
        engineRef.current.dispose();
      }
      
      engineRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      domeRef.current = null;
    };
  }, [imageUrl, mode]);

  // ZOOM FUNCTIONS
  const handleZoom = (deltaY) => {
    if (!domeRef.current) return;

    const zoomSensitivity = 0.001;
    const newFov = fovLevel - (deltaY * zoomSensitivity);
    
    const clampedFov = Math.max(0.3, Math.min(2.0, newFov));
    
    setFovLevel(clampedFov);
    domeRef.current.fovMultiplier = clampedFov;
  };

  const handlePinchZoom = (delta) => {
    if (!domeRef.current) return;

    const pinchSensitivity = 0.005; // Adjusted for mobile
    const newFov = fovLevel - (delta * pinchSensitivity);
    
    const clampedFov = Math.max(0.3, Math.min(2.0, newFov));
    
    setFovLevel(clampedFov);
    domeRef.current.fovMultiplier = clampedFov;
  };

  // Manual zoom controls (PC ONLY)
  const zoomIn = () => {
    if (!domeRef.current || isMobile()) return;
    
    const newFov = Math.max(0.3, fovLevel - 0.2);
    setFovLevel(newFov);
    domeRef.current.fovMultiplier = newFov;
  };

  const zoomOut = () => {
    if (!domeRef.current || isMobile()) return;
    
    const newFov = Math.min(2.0, fovLevel + 0.2);
    setFovLevel(newFov);
    domeRef.current.fovMultiplier = newFov;
  };

  const resetZoom = () => {
    if (!domeRef.current) return;
    
    setFovLevel(1.0);
    domeRef.current.fovMultiplier = 1.0;
    setShowZoomIndicator(false);
  };

  // Enhanced mobile-friendly fullscreen
  const handleExpand = async () => {
    if (!containerRef.current) return;

    const element = containerRef.current;

    try {
      if (isFullscreen) {
        await exitFullscreen();
      } else {
        await enterFullscreen(element);
      }
    } catch (err) {
      console.log('Fullscreen error:', err);
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
      element.style.position = 'fixed';
      element.style.top = '0';
      element.style.left = '0';
      element.style.width = '100vw';
      element.style.height = '100vh';
      element.style.zIndex = '9999';
      element.style.background = '#000';
      setIsFullscreen(true);
      
      const existingCloseBtn = element.querySelector('.custom-close-btn');
      if (existingCloseBtn) {
        existingCloseBtn.remove();
      }
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'custom-close-btn';
      closeBtn.innerHTML = '✕';
      closeBtn.style.position = 'fixed';
      closeBtn.style.top = '20px';
      closeBtn.style.right = '20px';
      closeBtn.style.zIndex = '10001';
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
      
      document.body.appendChild(closeBtn);
      closeBtnRef.current = closeBtn;
      
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
        closeBtn.removeEventListener('click', handleClose);
      };
      
      closeBtn.addEventListener('click', handleClose, { once: true });
      
    } else {
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
      
      {/* Zoom Controls - PC ONLY */}
      {!isMobile() && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'row',
          gap: '8px',
          background: 'rgba(0,0,0,0.7)',
          padding: '8px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <button
            onClick={zoomIn}
            style={{
              background: 'rgba(30, 41, 59, 0.9)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '40px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Zoom In"
          >
            +
          </button>
          
          <button
            onClick={resetZoom}
            style={{
              background: 'rgba(59, 130, 246, 0.9)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              fontSize: '12px',
              cursor: 'pointer',
              minWidth: '40px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Reset Zoom"
          >
            {Math.round(fovLevel * 100)}%
          </button>
          
          <button
            onClick={zoomOut}
            style={{
              background: 'rgba(30, 41, 59, 0.9)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '40px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Zoom Out"
          >
            −
          </button>
        </div>
      )}

      {/* Mobile Zoom Indicator (Temporary) */}
      {isMobile() && showZoomIndicator && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(0,0,0,0.8)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)',
          pointerEvents: 'none'
        }}>
          Zoom: {Math.round(fovLevel * 100)}%
        </div>
      )}

      {/* Expand Button */}
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

      {/* Mobile Instructions */}
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
          👆 Drag to look around • 🤏 Pinch to zoom • Tap <strong>Full</strong> for fullscreen
        </div>
      )}
    </div>
  );
};

export default PhotoDomeViewer;