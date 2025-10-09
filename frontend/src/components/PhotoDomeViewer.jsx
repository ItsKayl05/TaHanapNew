import React, { useEffect, useRef } from "react";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

const PhotoDomeViewer = ({ imageUrl, mode = "MONOSCOPIC" }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
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
      camera.wheelPrecision = isMobile() ? 150 : 100; // Smoother on mobile
      camera.panningSensibility = isMobile() ? 3000 : 2000; // Better touch control
      
      camera.attachControl(canvasRef.current, true);

      // Add ambient light
      new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

      // Create PhotoDome with optimized settings
      const dome = new BABYLON.PhotoDome(
        "property-dome",
        imageUrl,
        { 
          resolution: isMobile() ? 64 : 96, // Lower on mobile for performance
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

      // Mobile-specific event listeners
      if (isMobile()) {
        document.addEventListener('touchstart', handleTouchPrevent, { passive: false });
      }

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
      
      if (isMobile()) {
        document.removeEventListener('touchstart', handleTouchPrevent);
      }
      
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

  // Prevent default touch behavior that interferes with fullscreen
  const handleTouchPrevent = (e) => {
    if (e.target.tagName === 'CANVAS') {
      e.preventDefault();
    }
  };

  // Enhanced mobile-friendly fullscreen with better error handling
  const handleExpand = async () => {
    if (!containerRef.current) return;

    const element = containerRef.current;

    try {
      if (isFullscreen) {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      } else {
        // Enter fullscreen - try all methods for maximum compatibility
        const requestFullscreen = 
          element.requestFullscreen ||
          element.webkitRequestFullscreen ||
          element.mozRequestFullScreen ||
          element.msRequestFullscreen;

        if (requestFullscreen) {
          // For iOS Safari, we need to handle this differently
          if (isMobile() && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
            // iOS specific fullscreen handling
            const videoElement = document.createElement('video');
            videoElement.style.display = 'none';
            document.body.appendChild(videoElement);
            
            try {
              await videoElement.requestFullscreen();
            } catch (iosError) {
              // Fallback for iOS
              element.style.position = 'fixed';
              element.style.top = '0';
              element.style.left = '0';
              element.style.width = '100vw';
              element.style.height = '100vh';
              element.style.zIndex = '9999';
              setIsFullscreen(true);
            } finally {
              document.body.removeChild(videoElement);
            }
          } else {
            await requestFullscreen.call(element);
          }
        } else {
          // Fallback for browsers that don't support fullscreen API
          element.style.position = 'fixed';
          element.style.top = '0';
          element.style.left = '0';
          element.style.width = '100vw';
          element.style.height = '100vh';
          element.style.zIndex = '9999';
          setIsFullscreen(true);
        }
      }
    } catch (err) {
      console.log('Fullscreen error:', err);
      // Enhanced fallback for mobile
      if (isMobile()) {
        const element = containerRef.current;
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
          
          // Add close button for custom fullscreen
          const closeBtn = document.createElement('button');
          closeBtn.innerHTML = '✕';
          closeBtn.style.position = 'absolute';
          closeBtn.style.top = '20px';
          closeBtn.style.right = '20px';
          closeBtn.style.zIndex = '10000';
          closeBtn.style.background = 'rgba(0,0,0,0.7)';
          closeBtn.style.color = 'white';
          closeBtn.style.border = 'none';
          closeBtn.style.borderRadius = '50%';
          closeBtn.style.width = '44px';
          closeBtn.style.height = '44px';
          closeBtn.style.fontSize = '20px';
          closeBtn.style.cursor = 'pointer';
          closeBtn.onclick = () => {
            element.style.position = '';
            element.style.top = '';
            element.style.left = '';
            element.style.width = '';
            element.style.height = '';
            element.style.zIndex = '';
            element.style.background = '';
            closeBtn.remove();
            setIsFullscreen(false);
          };
          element.appendChild(closeBtn);
        } else {
          // Exit custom fullscreen
          element.style.position = '';
          element.style.top = '';
          element.style.left = '';
          element.style.width = '';
          element.style.height = '';
          element.style.zIndex = '';
          element.style.background = '';
          setIsFullscreen(false);
        }
      }
    }
  };

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
          touchAction: isMobile() ? 'pan-x pan-y' : 'none'
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
          userSelect: 'none'
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
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          👆 Drag to look around • Tap <strong>Full</strong> for fullscreen
        </div>
      )}
    </div>
  );
};

export default PhotoDomeViewer;