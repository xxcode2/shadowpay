import { useEffect, useRef } from 'react';

/**
 * SpaceBackground - Procedural dark space background
 * Represents privacy, anonymity, and separation with planet-like orbs
 * No images, pure Canvas rendering
 */

interface Planet {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  speed: number;
  angle: number;
}

export default function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planetsRef = useRef<Planet[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Generate planets once (privacy orbs - separated, no connections)
    if (planetsRef.current.length === 0) {
      const colors = [
        'rgba(6, 182, 212, 0.15)',   // cyan-500 - primary brand
        'rgba(20, 184, 166, 0.12)',  // teal-500 - secondary
        'rgba(14, 165, 233, 0.1)',   // sky-500 - accent
        'rgba(99, 102, 241, 0.08)',  // indigo-500 - subtle
        'rgba(168, 85, 247, 0.06)',  // purple-500 - deep
      ];

      // Create 6-8 planets (privacy nodes)
      const planetCount = 6 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < planetCount; i++) {
        planetsRef.current.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          radius: 80 + Math.random() * 120, // Medium-large orbs
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: 0.3 + Math.random() * 0.4,
          speed: 0.01 + Math.random() * 0.02, // Ultra-slow drift
          angle: Math.random() * Math.PI * 2,
        });
      }
    }

    // Animation loop
    let lastTime = performance.now();
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw dark gradient base (deep space)
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height)
      );
      gradient.addColorStop(0, '#0a0a0f');     // Near black center
      gradient.addColorStop(0.5, '#050510');   // Deep space
      gradient.addColorStop(1, '#020208');     // Void edge
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw planets (privacy orbs)
      planetsRef.current.forEach((planet) => {
        // Ultra-slow orbital drift (anonymity movement)
        planet.angle += planet.speed * (deltaTime / 16);
        planet.x += Math.cos(planet.angle) * 0.02;
        planet.y += Math.sin(planet.angle) * 0.02;

        // Wrap around edges (continuous separation)
        if (planet.x < -planet.radius) planet.x = canvas.width + planet.radius;
        if (planet.x > canvas.width + planet.radius) planet.x = -planet.radius;
        if (planet.y < -planet.radius) planet.y = canvas.height + planet.radius;
        if (planet.y > canvas.height + planet.radius) planet.y = -planet.radius;

        // Draw soft radial glow (no sharp edges = privacy)
        const radialGradient = ctx.createRadialGradient(
          planet.x,
          planet.y,
          0,
          planet.x,
          planet.y,
          planet.radius
        );
        
        radialGradient.addColorStop(0, planet.color.replace(/[\d.]+\)$/, `${planet.opacity})`));
        radialGradient.addColorStop(0.4, planet.color.replace(/[\d.]+\)$/, `${planet.opacity * 0.4})`));
        radialGradient.addColorStop(0.7, planet.color.replace(/[\d.]+\)$/, `${planet.opacity * 0.1})`));
        radialGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = radialGradient;
        ctx.fillRect(
          planet.x - planet.radius,
          planet.y - planet.radius,
          planet.radius * 2,
          planet.radius * 2
        );
      });

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    />
  );
}
