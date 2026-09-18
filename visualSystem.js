// visualSystem.js

const CONFIG = {
  particleCount: 150,
  connectionDistance: 120,
  colors: ['#00FF88', '#00DDFF', '#FF00AA'],
  baseSpeed: 0.002
};

// Utilidades matemáticas
const TAU = Math.PI * 2;
const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

export default class VisualSystem {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.time = 0;
    
    // Parámetros reactivos del performance generativo
    this.params = {
      network: 0.1,      // Nivel de interconexión y acoplamiento (0 a 1)
      intensity: 0.1,    // Agitación y tamaño (0 a 1)
      architecture: 0.1  // Solidez de las estructuras (0 a 1)
    };
    
    this.current = { state: "latent" }; // latent, duality, community, etc.

    this.init();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  rgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16) || 255;
    const g = parseInt(hex.slice(3, 5), 16) || 255;
    const b = parseInt(hex.slice(5, 7), 16) || 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  init() {
    // Inicialización de Nodos Geométricos
    this.nodes = Array.from({ length: CONFIG.particleCount }, (_, i) => {
      // Distribución inicial pseudo-aleatoria
      const cx = Math.random();
      const cy = Math.random();
      
      return {
        id: i,
        originX: cx,
        originY: cy,
        px: 0,
        py: 0,
        size: 1.5 + Math.random() * 3.5,
        lane: i % 3, 
        
        // Propiedades de oscilación
        phase: Math.random() * TAU,
        naturalFrequency: 0.5 + Math.random() * 1.5,
        
        // Gramática visual: 3 (Triángulo), 4 (Cuadrado), 5 (Pentágono)
        polygonSides: (i % 3) + 3 
      };
    });
  }

  update(deltaTime = 0.016) {
    this.time += deltaTime;
    
    // Fuerza de acoplamiento para la sincronización de fases
    const couplingStrength = this.params.network * 0.15; 
    
    for (const node of this.nodes) {
      // 1. Sincronización de rotación (Acoplamiento de fase)
      // A mayor "network", los nodos abandonan su frecuencia natural para alinearse
      const targetPhase = this.time * node.naturalFrequency;
      node.phase = lerp(node.phase, targetPhase, couplingStrength);

      // 2. Comportamiento Espacial Dinámico
      // Movimiento de deriva basado en ruido sinoidal que reacciona a la intensidad
      const driftX = Math.cos(this.time * 0.3 + node.id) * (20 + this.params.intensity * 50);
      const driftY = Math.sin(this.time * 0.4 + node.id) * (20 + this.params.intensity * 50);
      
      node.px = (node.originX * this.canvas.width) + driftX;
      node.py = (node.originY * this.canvas.height) + driftY;
      
      // Envoltura de bordes (Toroidal)
      if (node.px < -50) node.originX = 1;
      if (node.px > this.canvas.width + 50) node.originX = 0;
      if (node.py < -50) node.originY = 1;
      if (node.py > this.canvas.height + 50) node.originY = 0;
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // El orden de renderizado afecta la composición final
    this.drawConnections();
    this.drawNodes();
  }

  drawConnections() {
    // La distancia máxima de conexión crece con el parámetro network
    const maxDist = CONFIG.connectionDistance * (0.5 + Math.pow(this.params.network, 0.5) * 1.5);
    this.ctx.lineWidth = 1;

    for (let i = 0; i < this.nodes.length; i++) {
      const a = this.nodes[i];
      
      // Salto de índices para optimizar rendimiento sin perder densidad aparente
      for (let j = i + 1; j < this.nodes.length; j += 3) {
        const b = this.nodes[j];
        
        const dx = a.px - b.px;
        const dy = a.py - b.py;
        const dist = Math.hypot(dx, dy);

        if (dist < maxDist) {
          // Atenuación por distancia y fuerza de la red
          const alpha = (1 - dist / maxDist) * (0.1 + this.params.network * 0.5);
          const sharedColor = CONFIG.colors[(a.lane + b.lane) % CONFIG.colors.length];
          
          this.ctx.strokeStyle = this.rgba(sharedColor, alpha);
          this.ctx.beginPath();
          this.ctx.moveTo(a.px, a.py);
          
          // Gramática visual de enlaces
          if (a.polygonSides === b.polygonSides) {
             // Entidades similares generan sinergia: Curvas orgánicas y elásticas
             const cpX = (a.px + b.px) / 2 + Math.sin(this.time * 2 + a.id) * 30 * this.params.intensity;
             const cpY = (a.py + b.py) / 2 + Math.cos(this.time * 2 + b.id) * 30 * this.params.intensity;
             this.ctx.quadraticCurveTo(cpX, cpY, b.px, b.py);
          } else {
             // Entidades diferentes generan puentes: Líneas rígidas y directas
             this.ctx.lineTo(b.px, b.py);
          }
          this.ctx.stroke();
        }
      }
    }
  }

  drawNodes() {
    // Si hay un asset de fondo (ej. estado duality), reducimos un poco la opacidad general
    const isDuality = this.current?.state === "duality";
    const alphaBoost = isDuality ? 0.75 : 1;

    for (const node of this.nodes) {
      const color = CONFIG.colors[node.lane % CONFIG.colors.length];
      
      // La opacidad individual reacciona a la intensidad global
      const alpha = Math.min(0.95, (0.3 + this.params.intensity * 0.6) * alphaBoost);
      if (alpha < 0.01) continue;

      this.ctx.save();
      this.ctx.translate(node.px, node.py);
      this.ctx.rotate(node.phase); // El ángulo es dictado por la fase sincronizada

      this.ctx.strokeStyle = this.rgba(color, alpha);
      // El relleno base es muy sutil
      this.ctx.fillStyle = this.rgba(color, alpha * 0.15);
      this.ctx.lineWidth = 1.5;

      // Construcción del polígono
      this.ctx.beginPath();
      for (let i = 0; i < node.polygonSides; i++) {
        const angle = (i / node.polygonSides) * TAU;
        // El tamaño pulsa ligeramente con la intensidad
        const radius = node.size * (1 + this.params.intensity * 0.5);
        
        const vx = Math.cos(angle) * radius;
        const vy = Math.sin(angle) * radius;
        
        if (i === 0) this.ctx.moveTo(vx, vy);
        else this.ctx.lineTo(vx, vy);
      }
      this.ctx.closePath();
      
      // Si la narrativa demanda "arquitectura/solidez", rellenamos las formas
      if (this.params.architecture > 0.4) {
        this.ctx.fillStyle = this.rgba(color, alpha * (this.params.architecture));
        this.ctx.fill(); 
      }
      
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  // Método para actualizar parámetros externamente (desde tu controlador UI/MIDI/Audio)
  setParams(newParams) {
    this.params = { ...this.params, ...newParams };
  }
  
  setState(newState) {
    this.current.state = newState;
  }
}